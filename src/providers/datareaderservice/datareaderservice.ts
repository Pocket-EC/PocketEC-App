import { Injectable } from '@angular/core';
import { NgZone } from '@angular/core';
import 'rxjs/add/observable/interval';
import { Observable } from 'rxjs/Observable';
import { Subscription} from 'rxjs/Subscription';
import { BackgroundMode } from '@ionic-native/background-mode';
import { SharedserviceProvider } from '../../providers/sharedservice/sharedservice';
import { StatusUpdateProvider } from '../../providers/statusupdateservice/statusupdateservice';
import { BtSerialProvider } from '../../providers/bt-serial/bt-serial';
import { DatabaseProvider } from '../../providers/database/database';
import { DataProcessingProvider } from '../../providers/dataprocessingservice/dataprocessingservice';





/*

*/
@Injectable()
export class DataReaderService {

  experimentId: number; //Unique rowid from local database.
  experimentMethod: methodParam;
  experimentRunning: boolean = false; //used by connect error handler for starting new experiment or continuing old.
  experimentFlag: boolean = false; //used by cleanUpUnfinishedCommands to check if restart must be experiment or calibration
  userStopsExperiment: boolean = false;
  connectionDropped: boolean = false; //Used to check if connection has dropped while waiting for response from device.

  samplingTimer$;
  checkForDelayTimer$; //Timer to handle delay in device response.
  timerForAlert: Date; //
  lastSampledTime: Date;


  waitForDevice: boolean = false;
  keepChecking: boolean = false;
  initialSamplingTime: Date;
  startTimerForConnecting: Date;

  noOfConnectAttempts:number = 0;
  userUpdate: string;


  arrayOfMeasurements: Array<measurement>;
  lastExecutedCommandInBuffer: String;
  lastExecutedStep: techniqueParam;

  connectionReset: number = -1; //can only be -1,0,1
  // -1 nothing going on with connection - device can be connected to.
  // 1 is connected - do not try to connect now.
  // 0 phone trying to reconnect with device.
  arrayOfSubscriptions: Array<Subscription> = []; //ONLY used by subroutines communicating with device.
  connectionSubscription;
  block: boolean = false; //Flag to block sampling inside timer.


  restartSamplingFlag = false;
  listOfPreconditions: Array<any>;
  noOfPreconditions: number = 0;
  listOfMeasures: Array<any>;
  noOfMeasures: number = 0;


  stopCalibration: boolean = false;
  runNumber: number = 1; //the current measurement number of an experiment (A measurement is execution of all measure steps in a method )

  postProcessingParamObj: postProcessingParams = null;
  // testing = true;
  testing = false;  //Used for testing error catching behaviour.


  constructor(
    public SharedService: SharedserviceProvider,
    public StatusUpdateService: StatusUpdateProvider,
    public BtSerialService: BtSerialProvider,
    public DatabaseService: DatabaseProvider,
    public DataProcessingService: DataProcessingProvider,
    public backgroundMode: BackgroundMode,
    private ngZone: NgZone


  ) {
      this.SharedService.subscribeToStopExperiment().subscribe((stopExperiment)=>{
        //load global variable here withe new value
        this.logError("User's Stop experiment requrest received",'');
        this.userStopsExperiment = stopExperiment;
      });
      this.backgroundMode.enable();
  }

  /**
  * Connect to device and call experiment handler.
  * Error handler of connectionSubscription will kick in whenever connection drops.
  * @param experimentName: string - User chosen experiment name. required.
  * @param method: methodParam object holding all parameters required for an experiment. required.
  * @param isNewExperiment set to false if start experiment is called from reconnect handler.
  * @param postProcessingParamObj contains parameters required for post processing of measured data.
  */

  async startExperiment(experimentName,method: methodParam,isNewExperiment: boolean, postProcessingParamObj:postProcessingParams): Promise<any>{
    if(experimentName == null || method == null){
      this.fatalErrorNeedsAttention('Cannot start an experiment without a name or method!','Error-SE');
      return;
    }
    this.postProcessingParamObj = postProcessingParamObj;

    let promise = new Promise((resolve,reject)=>{
      this.logError('Experiment STARTING','');
      this.StatusUpdateService.setStatusUpdate('Trying to connect..');

      this.disconnectDevice()
      .then(() => {
        //disable old threads -
        return this.unsubscribeAll(0)
      })
      .then(()=>{
        return this.disablePreviousTimers()
      })
      .then(()=>{
        if(this.connectionSubscription){
          this.connectionSubscription.unsubscribe();
        }
        this.connectionSubscription = this.BtSerialService.connectToDevice(this.SharedService.device.address)
        .subscribe((connected)=>{
          this.logError('Device Connected at:',new Date().toISOString());
          this.connectionDropped = false;
          this.StatusUpdateService.setLoadingSpinner(false);
          this.StatusUpdateService.setStatusUpdate(this.SharedService.device.name + ': Connected!');
          this.StatusUpdateService.setDisableButton(false);

          //reinitialize to 0 for handle-Reconnecting subroutine which is called with a null startTimerForConnecting
          this.noOfConnectAttempts = 0;
          if(this.connectionReset == 0){ //CHECK if app had been trying to reestablish connection
            this.connectionReset = 1; //reset to connected status.
          }

          if(this.userStopsExperiment){
            this.logError('Stop Experiment User Request detected after connecting to device:',new Date().toISOString());
            this.StatusUpdateService.setSpinnerText('Setting device into parking mode..');
            this.userStopsExperiment = false;
            // Check if voltage needs to be set to be parking mode (switchOffVoltage)
            if(!method.postMeasureSetContinuousVoltage){
              this.StatusUpdateService.setStatusUpdate('Standby/parking mode..');
              this.switchOffVoltage(this.SharedService.deviceSetting.parkingMode);
            }
          }
          else{
            //set device as busy here.
            this.StatusUpdateService.setDeviceIsBusy(true);
            this.SharedService.samplingPaused(false); //To announce to btdevicepage that sampling is starting so device unavailable. TODO remove
            this.handleExperiment(experimentName,this.experimentId, method,isNewExperiment,postProcessingParamObj);
          }
        },(connectError) => {
          this.connectionDropped = true;
          this.logError('Error Connecting:  ' + JSON.stringify(connectError) + ' this.noOfConnectAttempts ' + this.noOfConnectAttempts, '');

          if(this.userStopsExperiment){
            this.logError('userStopsExperiment detected: Stop trying to reconnect','');

            this.StatusUpdateService.setLoadingSpinner(false);
            this.StatusUpdateService.setSpinnerText('Stopped Experiment!');
            this.StatusUpdateService.setStatusUpdate('Stopped connecting');
            this.StatusUpdateService.setExperimentStatus(false);
            this.StatusUpdateService.setDisableButton(false);
            this.disablePreviousTimers(); //make sure all timers are unsubscribed
            this.StatusUpdateService.setDeviceIsBusy(false);
            this.userStopsExperiment = false;
            this.experimentRunning = false;
            this.experimentFlag = false;
          }
          else{
            this.noOfConnectAttempts++;
            this.connectionReset = 0; //
            this.StatusUpdateService.setLoadingSpinner(true);
            this.StatusUpdateService.setSpinnerText('Trying to reconnect..')
            this.StatusUpdateService.setDisableButton(false);

            this.disablePreviousTimers();
            this.unsubscribeAll(0).then(()=>{
              if(this.experimentRunning){
                this.startExperiment(experimentName,method,false,this.postProcessingParamObj); //so that data is added to the old experiement
              }
              else{
                this.startExperiment(experimentName,method,true,this.postProcessingParamObj); //start new experiement
              }
            });

          }
        });
      })
      .catch((disconnectError)=>{
        reject(disconnectError);
      });
    });
    return promise;
  }


  /** Is called to measure offset/standard 2 for calibrations.
  * @param listofSteps: techniqueParam - step parameters required for measurements.
  * @return array of measurements. {data, startTime}[]
   */

  async startCalibrationRun(listofSteps: techniqueParam []): Promise<stepData[]>{

    let promise = new Promise<stepData[]>((resolve,reject)=>{
      this.logError('Calibration is being STARTED','');
      this.experimentFlag = false;
      this.stopCalibration = false;

      this.disconnectDevice()
      .then(() => {//disable old threads -
        return this.unsubscribeAll(0)
      })
      .then(()=>{
        return this.disablePreviousTimers()
      })
      .then(()=>{
        if(this.connectionSubscription){
          this.connectionSubscription.unsubscribe();
        }
        this.connectionSubscription = this.BtSerialService.connectToDevice(this.SharedService.device.address)
          .subscribe((connected)=>{
            this.logError('Device Connected at',new Date().toISOString());
            this.StatusUpdateService.setLoadingSpinner(false);
            this.StatusUpdateService.setStatusUpdate('Connected!');
            // this.StatusUpdateService.setDisableButton(false);
            this.StatusUpdateService.setStatusUpdate('Connected');

            if(this.stopCalibration){
              this.StatusUpdateService.setLoadingSpinner(false);
              this.StatusUpdateService.setStatusUpdate('Stop detected..');
              this.logError(' stopCalibration flag detected in startCalibration',new Date().toISOString());
              this.stopExperiment('Calibration stopped..'); //async
            }
            else{
              this.SharedService.samplingPaused(false); //To announce to btdevicepage that sampling is starting so device unavailable.
              resolve(this.handleCalibrationRun(listofSteps));
            }
          },(connectError) => {
            this.logError('Error Connecting:  ' + JSON.stringify(connectError) + ' this.noOfConnectAttempts ' + this.noOfConnectAttempts, '');
            this.StatusUpdateService.setStatusUpdate('Error connecting!');
            if(this.noOfConnectAttempts == 0){
              //this is the first time handle_Reconnecting is called (will be called everytime a reconnect attempt is made as part of handle_Reconnecting subroutine)
              this.startTimerForConnecting = null;
              this.noOfConnectAttempts++;
            }
            if(!this.SharedService.getStopReconnect()){
              //Show user error that calibration could not be performed.
              reject(connectError);
            }
            else{
              this.logError('Stop trying to reconnect','');
              this.SharedService.setStopReconnect(false);
              this.ngZone.run(() => {
                this.disablePreviousTimers(); //make sure all timers are unsubscribed
              });
            }
          });
      })
      .catch((disconnectError)=>{
        this.logError('disconnectError: and is rejected.','');
        reject(disconnectError);
      });
    });
    return promise;
  }

  /**
  * Stop calibration.. sets stopCalibration to stop experiment between step measurements.
  *
  */

  stopCalibrationRun(){
    this.stopCalibration = true;
    this.StatusUpdateService.setLoadingSpinner(true);
    this.StatusUpdateService.setSpinnerText('Stopping calibration..');
    this.StatusUpdateService.setDisableButton(true);
  }

  /**
  * Handles measurements of all steps needed for calibration run.
  * @param listofSteps - list of steps needed for measurement.
  * @return array of data from each step.
  */
  async handleCalibrationRun(listofSteps: techniqueParam[]): Promise<stepData[]>{
    let stepRef;
    let arrayOfStepData: Array<stepData> = [];
    this.runNumber = 1;

    try{
      for(let i=0; i < listofSteps.length; i++){
        stepRef = this.lastExecutedStep = listofSteps[i];
        let stepData =  await this.startStep(stepRef,(i+1),'Calib Step ',this.runNumber);
        stepData.zeroOffset = stepRef.zeroOffset;
        stepData.scalingFactor = stepRef.scalingFactor;
        arrayOfStepData.push(stepData);
        if(this.stopCalibration){
            this.logError('Stop calibration detected..','');
            break;
        }
        this.waitFunction(20);
        this.runNumber++;
      }

      await this.stopExperiment('Calibration stopped..');

      this.SharedService.samplingPaused(true);//To announce to btdevicepage that sampling has stopped so device is available. .
      if(!this.stopCalibration){
        return arrayOfStepData;
      }
      else{
        throw Error('STOPPEDBYUSER');
      }
    }
    catch(err){
      if(this.stopCalibration){
          this.SharedService.showToast('Calibration stopped by user');
          this.logError('Error during Calibration, show message and exit ',err);
      }
      else{
        this.logError('Error during Calibration, show message and exit ',err);
        await this.stopExperiment('Calibration stopped..');
        this.waitForDevice = false;
        this.SharedService.showToast('An error occured during calibration: ' + err,'middle');
      }
    }
  }


  /**
  * Stop sampling of bluetooth device here
  * @param list of steps/techniques
  * @param index: number index of step/technique that called stop.
  * @param preconditionFlag: if true - list of techniques is preconditions.
  * @param forceStop if true, force experiment to stop without waiting for cycle completion.
  */

  async stopExperiment(message): Promise<boolean>{
    try{
      this.logError('Stopping Measurement','');
      this.block = true; //stops further data reads
      //stop the service here by unsubscribing from timers
      await this.disablePreviousTimers();
      //clean up device connection.
      await this.unsubscribeAll(0);
      await this.disconnectDevice();
      this.waitForDevice = false;
      this.StatusUpdateService.setLoadingSpinner(false);
      this.StatusUpdateService.setSpinnerText(message);
      this.StatusUpdateService.setExperimentStatus(false);
      this.experimentRunning = false;
      this.experimentFlag = false;
      this.StatusUpdateService.setDisableButton(false);
      this.SharedService.samplingPaused(true);
      this.StatusUpdateService.setStatusUpdate(message);
      this.StatusUpdateService.setDeviceIsBusy(false);
      return true;
    }
    catch(error){
      throw error;
    }
  }

  /**
  * Creates a new experiment if needed and collects data and stores in local database as specified by method param.
  * @param experimentName required param
  * @param currentExperimentId Can be null (will be null if isNewExperiment is set to true. )
  * @param method: methodParam contains instructions for experiemnt
  */

  async handleExperiment(experimentName:string, currentExperimentId: number,method,isNewExperiment:boolean,postProcessingParamObj){
    try{
      let tempCommand: string = '';
      let stepRef;
      let experimentId = currentExperimentId;

      this.experimentRunning = true;
      this.experimentFlag = true;


      //Running precondition steps only if a new experiment is started, otherise continue with measurements.
      //Will fail In case connecection dropped during precondition steps.

      if(isNewExperiment){
        if(experimentName == null){
          throw Error('Experiment Name cannot be null');
        }
        this.SharedService.commsErrorArray = []; //empty log from previous experiment.
        this.SharedService.dataForLiveConcCalcArray = [];

        this.postProcessingParamObj = await this.DatabaseService.addNewPostProcessingParamRecord(postProcessingParamObj,this.SharedService.userId,this.SharedService.deviceId);
        this.SharedService.setPostProcessingParamObj(this.postProcessingParamObj);
        experimentId = await this.DatabaseService.createNewExperiment(experimentName,method,postProcessingParamObj.databaseRowid);


        this.experimentId = experimentId;
        this.SharedService.setCurrentExperimentId(experimentId);
        if(method == null){
          throw Error('Method object cannot be null or undefined');
        }
        this.experimentMethod = this.SharedService.createNewMethod(method);
        this.StatusUpdateService.setLoadingSpinner(false);
        this.runNumber = 1; //reset for new experiment


        this.listOfPreconditions = method.listOfPreconditions;
        this.noOfPreconditions = this.listOfPreconditions.length;
        let runNumber = 1;
        for(let j=0; j < method.preconditionRepetition; j++){
          for(let i=0; i < this.noOfPreconditions; i++){
            stepRef = this.lastExecutedStep = this.listOfPreconditions[i];
            let stepData =  await this.startStep(stepRef,(i+1),'Prec.Step ',runNumber);
            if(stepRef.save){
              tempCommand = stepRef.gain.command + ' ' + stepRef.potential.command + ' ' + this.SharedService.deviceSetting.setRegisterModeTemp;
              this.logError('Measuring temperature ','');
              let temperature = await this.readTemperature(tempCommand);
              this.logError('Measured temperature: ' + temperature,'');
              await this.storeStepData(stepData,experimentId,stepRef.databaseRowid,stepRef.stepNumber,temperature,stepData.startTime);
            }
          }
        }
      }
      else{
        if(experimentId == null){
          throw Error('Experiment Id cannot be null');
        }
      }

      //Running Measure Steps
      this.listOfMeasures = method.listOfMeasures;
      this.noOfMeasures = this.listOfMeasures.length;


      // runNumber=1;
      while(true){
      let arrayOfStepData: Array<stepData> = [];
      let stepData = null;
      let temperature = null;
        try{
          for(let i=0; i < this.noOfMeasures; i++){
            stepRef = this.lastExecutedStep = this.listOfMeasures[i];
            try{
              stepData =  await this.startStep(stepRef,(i+1),'Meas.Step ',this.runNumber);
              // throw Error('checking if startstep throws an error');
            }
            catch(e){
              this.logError('Error in start step, continue',e);
              this.SharedService.saveCommunicationErrors(new Date().toISOString() + ' Error returned by startStep');

            }

            if(stepRef.save && stepData !=null){
              tempCommand = stepRef.gain.command + ' ' + stepRef.potential.command + ' ' + this.SharedService.deviceSetting.setRegisterModeTemp;
              try{
                temperature = await this.readTemperature(tempCommand);
              }
              catch(e){
                this.logError('Error in temperature read, continue',e);
                this.SharedService.saveCommunicationErrors(new Date().toISOString() + ' Temperature missing');
              }
              if(stepData != null){
                this.logError('Measured temperature: ' + temperature,'');
                let storedData = await this.storeStepData(stepData, experimentId, stepRef.databaseRowid,stepRef.stepNumber,temperature,stepData.startTime);
                this.logError('Stored: ' + storedData,'');
                if(postProcessingParamObj.algorithm.step1Index == stepRef.stepNumber){
                  arrayOfStepData[0] = stepData;
                }
                else{
                  if(postProcessingParamObj.algorithm.step2Index != null){
                    if(postProcessingParamObj.algorithm.step2Index == stepRef.stepNumber){
                      arrayOfStepData[1] = stepData;
                    }
                  }
                }
              }
            }
          }
          //push data into processing stack for realTime display.
          if(this.SharedService.displayLiveConcUpdate && arrayOfStepData.length != 0){
            this.SharedService.dataForLiveConcCalcArray.push(arrayOfStepData);
          }
        }
        catch(err){
          this.logError('Error during measurement, continue: ',err);
          this.disablePreviousTimers();
          await this.unsubscribeAll(0);
          this.waitForDevice = false;
          this.handleExperiment(experimentName,this.experimentId,method,false,this.postProcessingParamObj);
          return;
        }

        this.runNumber++;
        if(this.userStopsExperiment){
          this.logError('userStopsExperiment detected in handleExperiment ','');
          this.userStopsExperiment = false;
          break;
        }
        if(!method.continuousMeasure){
          if(this.runNumber > method.measuresRepetition){
            break; //go out of while loop.
          }
        }
        this.waitFunction(50);
      }
      // Check if voltage needs to be set to be parking mode (switchOffVoltage)
      if(method.postMeasureSetContinuousVoltage){
        this.stopExperiment('Experiment stopped..').then(()=>{
          this.StatusUpdateService.setSpinnerText('Stopped Experiment!');
          this.StatusUpdateService.setLoadingSpinner(false);
          this.StatusUpdateService.setDisableButton(false);
          this.StatusUpdateService.setExperimentStatus(false);
          this.StatusUpdateService.setDeviceIsBusy(false);
          this.StatusUpdateService.setStatusUpdate('Experiment stopped!');
          this.experimentRunning = false;
          this.experimentFlag = false;
        })
        .catch((e)=>{
          this.StatusUpdateService.setLoadingSpinner(false);
          this.StatusUpdateService.setSpinnerText('Stopped Experiment with Error!');
          this.StatusUpdateService.setDisableButton(false);
          this.StatusUpdateService.setStatusUpdate('Stopped Experiment with Error!');
          this.StatusUpdateService.setDeviceIsBusy(false);
          this.StatusUpdateService.setStoppedWithError(e);
          this.StatusUpdateService.setExperimentStatus(false);
          this.disablePreviousTimers();
          this.disconnectDevice();
          this.unsubscribeAll(0);
          this.waitForDevice = false;
          this.experimentRunning = false;
          this.experimentFlag = false;
          this.logError('Error stopping the experiment','');
          throw e;
        });
      }
      else{
        this.StatusUpdateService.setSpinnerText('Standby/parking mode..');
        this.switchOffVoltage(this.SharedService.deviceSetting.parkingMode);
      }
    }
    catch(err){
      this.logError('Experiment could not be completed: ',err);
      this.disablePreviousTimers();
      await this.disconnectDevice();
      this.unsubscribeAll(0);
      this.waitForDevice = false;
      this.experimentRunning = false;
      this.experimentFlag = false;
      this.StatusUpdateService.setDeviceIsBusy(false);
      this.StatusUpdateService.setStoppedWithError(err);
      this.fatalErrorNeedsAttention('Experiment could not be completed due to an error',err);
    }
  }

  calcConcForStatusUpdate(){
    if(this.SharedService.dataForLiveConcCalcArray.length > 0){ //make this local maybe?
      let arrayOfStepData = this.SharedService.dataForLiveConcCalcArray.shift();
      if(arrayOfStepData == null || arrayOfStepData == undefined){
        this.logError('arrayOfStepData was null or undefined, can not calc conc.','');
        return;
      }
      this.DataProcessingService.showLive(arrayOfStepData,this.postProcessingParamObj,this.listOfMeasures).then((result)=>{
        let conc = this.DatabaseService.roundNumber(result,2);
        this.logError('rounded number : ' + conc,'');
        this.StatusUpdateService.setLastMeasuredConcentration(conc + ' ' + this.postProcessingParamObj.unitDependentOnSensitivity);
      })
      .catch((e)=>{
        this.logError('Concentration could not be calculated and displayed ',e);
      });
    }
    else{
      this.logError('No data to show live conce. ','');
    }
  }

  /**
  * Sets device configuration as specified in step parameters (techniqueParam) and either samples device reading or waits as specified in step parameters
  *
  *
  */

  async startStep(step:techniqueParam,index:number,typeOfStep:string, runNumber:number): Promise<stepData>{ //{data: any, date: Date}[]>{

    // this.logError(typeOfStep + ' step: ' + index + ' parameters: ' + JSON.stringify(step),'');
    this.logError('Starting ' + typeOfStep + ' step: ' + index,'');
    this.arrayOfMeasurements = [];


    let promise = new Promise<stepData>((resolve, reject) => {
      this.arrayOfSubscriptions = []; //clean up observables

      //command format 28 157 3
      let command = step.gain.command + ' ' + step.potential.command + ' ' + this.SharedService.deviceSetting.setRegisterModeData;

      this.userUpdate = ('Run ').
        concat(String(runNumber)).
        concat(': ' + typeOfStep + ' ').
        concat(String(index)).
        concat(': ').
        concat(step.gain.description).
        concat(' ').
        concat(step.potential.description).
        concat(' @ ').
        concat(String(step.dataFrequency)).
        concat(' ms for ').
        concat(String(step.duration)).
        concat(' s ');

      this.StatusUpdateService.setStatusUpdate(this.userUpdate);

      this.sendNewCommandsToDevice(command)
      .then((timeStamp)=>{
        this.initialSamplingTime = timeStamp;

        if(step.save){
          //Start timer for sampling.
          this.block = false;
          this.logError('stepStartTime: ' + timeStamp.toISOString() + new Date().toISOString(),'')
          this.samplingTimer$ = Observable.timer(step.dataFrequency,step.dataFrequency).subscribe((val) => {
            // 1.check if sampling has to stop, check if it has to be paused, check if prev read has finished.
            this.logError(typeOfStep + ': ' + index +':Reading no. ' + val, new Date().toISOString());
            //check if previous read has finished, if unfinished skip sampling.
            if(this.block){
              this.logError(val +' - Skipped as previous read did not finish','');
              return; //stop execution of this run.
            }
            else{
              if(this.waitForDevice){
                //Can get stuck here - TODO needs handler for timing out after 10 seconds.
                this.logError(val + ' -Skip sampling as waitForDevice flag is true','');
                return;
              }
              else{
                this.block = true;
                 this.readDataFromDevice(val)
                .then((dataObject)=>{
                  this.arrayOfSubscriptions = []; //clean up observables addded in read-DataAsBytes subroutine.
                  this.StatusUpdateService.setLastSampledTime(dataObject.date); //update user view.
                  this.arrayOfMeasurements.push(dataObject);
                  if(this.goToNextSegment(this.initialSamplingTime,step.duration)){
                    this.logError('Go to next step - unsubscribe samplingTimer$: ' + new Date().toISOString(),'');
                    this.samplingTimer$.unsubscribe();
                    //this.block = false; //TODO commented to check if this makes a difference.
                    resolve({
                    startTime:this.initialSamplingTime,
                    data: this.arrayOfMeasurements,
                    zeroOffset: step.zeroOffset,
                    scalingFactor:step.scalingFactor,
                    stepId:step.stepNumber
                  });
                  }
                  else{
                    this.block = false;
                  }
                },(readError)=>{
                  this.logError('Read error: ' ,readError);
                  this.SharedService.saveCommunicationErrors(new Date().toISOString() + ' Data missing');

                  //continue reading data
                  this.block = false;

                  // this.block = true; //stop next run
                  // this.samplingTimer$.unsubscribe();
                  // this.cleanUpUnfinishedCommands(this.experimentId,this.experimentMethod);
                });
              }
            }//end else
          },(samplingTimerError) =>{
            this.logError('SamplingTimer$ subscription did not initialize: ',samplingTimerError);
            this.fatalErrorNeedsAttention('HomePage: samplingTimer$ subscription did not initialize: ',samplingTimerError);
            reject(samplingTimerError);
          });
        }
        else{ // if step does not save data
          this.logError(typeOfStep + ' Do not save data for this step: ' + index,'');
            this.userUpdate = ('Run ').
            concat(String(runNumber)).
            concat(': ' + typeOfStep +' ' ).
            concat(String(index)).
            concat(': Not saved for ').
            concat(String(step.duration)).
            concat(' s ');
            this.StatusUpdateService.setStatusUpdate(this.userUpdate);
            // this.logError('DRS: Displaying displayLiveConcUpdate ' + this.SharedService.displayLiveConcUpdate,'');
            if(this.SharedService.displayLiveConcUpdate){

              this.calcConcForStatusUpdate();
            }
            else{
              this.logError('Real time conc. display switched off','');
            }
            setTimeout(()=>{
              this.logError(step.duration +'s over! Go to the next step now!',new Date().toISOString());

              this.StatusUpdateService.setStatusUpdate('');
              resolve({
                startTime: this.initialSamplingTime,
                data:this.arrayOfMeasurements,
                zeroOffset: step.zeroOffset,
                scalingFactor:step.scalingFactor,
                stepId: step.stepNumber});
            },step.duration * 1000);
        }
      },(sendCommandsError)=>{
          this.SharedService.downloadDebugFile(true);
          this.cleanUpUnfinishedCommands(this.experimentId,this.experimentMethod,).then(()=>{
            this.logError('Restarting step','');
            this.startStep(step,index,typeOfStep,runNumber).then((data)=>{
              resolve(data);
            });
          });
      });
    }); //finish defining promise.
    return await promise;

  }




  /**
  * Configure BT device to read temperature (JSON properties dependent) and return as string of sensor bits.
  * Remarks: BT device specific conversion to centigrade units performed in DatabaseService before storage.
  * @param tempCommad: string Contains three values to send to BT device to configure registers. Ex://tempCommand = '28 157 7';
  * @return Value as a string, units is sensor response bits.
  */

  async readTemperature(tempCommand:string ): Promise<String>{
    try{
      if(this.waitForDevice){
        this.logError('Should not happen! device is busy for readTemperature','');
        throw Error('Device is busy: ' + (new Date()).toISOString());
      }
      this.lastExecutedCommandInBuffer = this.SharedService.deviceSetting.readTemperature.Tx;

      await this.sendNewCommandsToDevice(tempCommand);
      this.logError('Configured device to measure temperature: ' + tempCommand,'');
      this.waitForDevice = true;
      await this.BtSerialService.writeToDeviceAsChar(this.SharedService.deviceSetting.readTemperature.Tx);
      this.logError('Tx to device: ' + this.SharedService.deviceSetting.readTemperature.Tx,'');
      if(this.SharedService.deviceSetting.readTemperature.RxAsString){
        this.startDeviceResponseDelayHandler(14000);
        this.waitFunction(50);
        this.logError('Waiting for response to cmd: "' + this.SharedService.deviceSetting.readTemperature.Tx,'');
        let dataString = await this.readUntilDelimitter(this.SharedService.deviceSetting.responseDelimiter);
        this.logError('Response: ' + dataString,'');

        //let dataString = await this.readAsString();
        this.stopDeviceResponseDelayHandler();
        this.waitForDevice = false;
        return dataString;
      }
      else{
        this.startDeviceResponseDelayHandler(14000);
        this.logError('Waiting for response to cmd: "' + this.SharedService.deviceSetting.readTemperature.Tx,'');
        let dataBuffer =  await this.readRawData(this.SharedService.deviceSetting.readTemperature.RxLength);
        let temperature = String(this.DatabaseService.convertToInteger(new Uint8Array(dataBuffer)));
        this.logError('Response: ' + temperature,'');
        this.stopDeviceResponseDelayHandler();
        this.waitForDevice = false;
        return temperature;
      }
    }
    catch(error){
      this.SharedService.showToast('Could not get a temperature reading');
      this.waitForDevice = false;
      this.logError('Error reading temperature. ','');
      throw error;
    }
  }

  /*
  * Read bytes from input stream, (in format LSB MSB CR) convert to integer => string.
  * Only used for reading temperature.
  */

  async readRawData(reqdLength): Promise<number[]>{
    let dataBuffer: number[] = [];
    let rawBytesObserver: Observable<any> = null;
    let rawBytesSubscription = null;
    let promise = new Promise<number[]>((resolve,reject)=>{
      rawBytesObserver = this.BtSerialService.subscribeRawData();
      rawBytesSubscription = rawBytesObserver.subscribe((dt)=>{
        let tempBuffer = new Uint8Array(dt);
        // this.logError('tempBuffer: ',tempBuffer );
        let tempBufferLength = tempBuffer.length;
        for(var i=0; i<tempBufferLength; i++){
          dataBuffer.push(tempBuffer[i]);
        }


        if(dataBuffer.length == reqdLength){
          if(rawBytesSubscription!= null){
            rawBytesSubscription.unsubscribe();
          }
          resolve(dataBuffer);
        }
        if(dataBuffer.length > reqdLength){
          this.logError('Rx incorrect response buffer.  '  + new Uint8Array(dataBuffer),'');
          this.logError('Rx incorrect response in string fmt: ' + String.fromCharCode.apply(null, new Uint8Array(dataBuffer)),'');
          if(rawBytesSubscription!= null){
            rawBytesSubscription.unsubscribe();
          }
          this.waitForDevice = false;
          reject('W');
        }
        if(!this.keepChecking){
          if(rawBytesSubscription!= null){
            rawBytesSubscription.unsubscribe();
          }
          this.waitForDevice = false;
          reject('Timed out');
          return;
        }
      },(subscribeError)=>{
        this.SharedService.showToast('Device ' + this.SharedService.device.name + ' does not allow subscription to raw data. Error Code: RDFD ');
        this.logError('Could not subscribe to raw data from device:  ',subscribeError);
        this//.waitForDevice = false;
        reject(subscribeError);
      });
    }).catch(error=>{
      this.logError('Error reading data as bytes array. ','');
      throw error;
    });
    this.arrayOfSubscriptions.push(rawBytesSubscription);
    return promise;
  }

  /**
  * @param value: string takes the expected response from the device.
  * @param length: number takes the expected number of bytes from the device.
  * @return string
  * Used to read responses to config commands
  * Bytes are read from the device subscription till the reqd response length is received, cast to string and returned
  */


  getResponseFromDevice(value,length): Promise<string>{
    let reading = '';
    let dataBuffer: number[] = [];
    this.keepChecking = true;
    let promise = new Promise<string>((resolve, reject) => {
      let observable = this.BtSerialService.subscribeRawData().subscribe((dt)=>{
        let tempBuffer = new Uint8Array(dt);
        let tempBufferLength = tempBuffer.length;
        for(var i=0; i<tempBufferLength; i++){
          dataBuffer.push(tempBuffer[i]);
        }
        if(dataBuffer.length >= length){
          observable.unsubscribe();
          reading = String.fromCharCode.apply(null, new Uint8Array(dataBuffer)); //Are they still in ascii?
          if(reading.includes(value)){
            resolve(reading);
            return;
          }
          else{
            reject('Rx incorrect response: ' + reading);
            return;
          }
        }
        if(!this.keepChecking){
          observable.unsubscribe();
          reject('Timed out');
          return;
        }
      },(subscribeError)=>{
        this.logError('Could not subscribe to raw data from device:  ',subscribeError);
        reject(subscribeError);
      });
      this.arrayOfSubscriptions.push(observable);
    });
    return promise;
  }

  /**
  *  Checks if bytes are available in buffer, reads the data till delimiter and returns a string value.
  *  String is empty if buffer does not contain the delimiter.
  *  @param delimiter: the expected delimiter from the device.
  */

  async readUntilDelimitter(delimiter:string){

    let dataBuffer = null;
    let deviceReply = '';
    try{
      this.keepChecking = true;
      while(this.keepChecking){
        let bytes = await	this.BtSerialService.checkIfBytesAvailable();
        if(bytes > 0){
          dataBuffer = await this.BtSerialService.readFromDevice();
          deviceReply = deviceReply.concat(dataBuffer);
          this.logError('From buffer: ' + dataBuffer,'');
          if(deviceReply.endsWith(this.SharedService.deviceSetting.responseDelimiter)){
            const index = deviceReply.lastIndexOf(this.SharedService.deviceSetting.responseDelimiter);
            deviceReply = deviceReply.slice(0,index);
            break;
          }
          else{
            //keepcheking.
            this.logError('No delimiter in sight, keep reading','');
          }

        }
        await this.waitFunction(10);
      }

      //await this.BtSerialService.clearBuffer();
      if(this.keepChecking){
        this.logError('Response Rx w/ delimiter ' + delimiter + ': ' + deviceReply,'');
        return deviceReply;
      }
      else{
        this.logError('Timed out! ','');
        throw Error('Timed out');
      }
    }
    catch(error){
      this.logError('Error in read Until Delimitter: ', '');
      throw error;
    }
  }

  /**
  * Creates a delay in while loop
  */
  waitFunction(delay){
    let promise = new Promise<boolean>((resolve,reject)=>{
      setTimeout(()=>{
        resolve(true);
      },delay);
    });
    return promise;
  }



  /**
  * Store step data in local database once all measurements for a step is completed
  * @param array - array of measurement object holding data and timestamp from device.
  * @param experimentId - unique database id for storing data.
  * @param stepId - unique database id indicating step parameters used for measurement
  * @param temperature - temperature in sensor response units measured at the end of step.
  * @param stepStartTime - Time of start of the experiment.
  * Returns null if there is no data in array. TODO
  */

  async storeStepData(stepData:stepData,experimentId:number,stepId:number,stepNumber:number,temperature:String,stepStartTime:Date): Promise<experimentDataObject>{

    let promise =  new Promise<experimentDataObject>((resolve,reject)=>{
      if(stepData.data.length==0){
        this.logError('Empty measurement array: ', '');
        resolve(null);
        return;
      }
      return this.DatabaseService.addStepData(stepData,experimentId,stepId,stepNumber,temperature,stepStartTime)
      .then((data)=>{
        this.logError('Stored Step data: No. of Stored readings: ' + stepData.data.length,'');
        // this.logError('Print experiment id: ' + experimentId,'' );
        this.SharedService.setLastSavedExperimentId(experimentId);
        resolve(data);
      })
      .catch( error => {
        this.logError('Sqlite error: ',error);
        //Stop sampling here..
        this.fatalErrorNeedsAttention('Sqlite error: ',error);
      });
    })
    .catch(err=>{
      throw err;
    });
    return promise;

  }


  /**
  * Check if sampling should stop to go to next segment/step
  * @param begin: timestamp of start of the segment/step
  * @param duration no. of seconds set by user for the segment/step
  * @return boolean Return true if time for next step.

  */

  goToNextSegment(begin:Date,duration: number){
    //Check if sampling has to be paused here.
    if(((new Date()).getTime() - begin.getTime())/1000 > duration){
      return true;
    }
    else{
      return false;
    }
  }


  /*
  Clean up before starting to sample
  */

  async disablePreviousTimers(){
    if(this.samplingTimer$){
      this.samplingTimer$.unsubscribe();
      this.samplingTimer$ = null;
    }
    return;
  }
  /*
  Called in unrecoverable cases - sampling will be stopped
  */
  async fatalErrorNeedsAttention(message,error){
    this.disablePreviousTimers();
    this.StatusUpdateService.setSpinnerText('Fatal error occured.. stopping..');
    try{
      await this.stopExperiment('Experiment Stopped');
      this.handleFatalError(message,error);
    }
    catch(e){
      this.logError('Error stopping experiment ',e);
      this.SharedService.showToast('Device disconnected with errors');
      this.disablePreviousTimers();
      await this.unsubscribeAll(0);
      await this.disconnectDevice();
      this.waitForDevice = false;
      this.handleFatalError(message,error);
    }
  }

  /**
  * Handler for end of experiment with error status settings and debug file export.
  *
  */
  handleFatalError(message,error){
    this.StatusUpdateService.setDeviceIsBusy(false);
    this.StatusUpdateService.setStoppedWithError(error);
    this.experimentRunning = false;
    this.experimentFlag = false;
    this.StatusUpdateService.setLoadingSpinner(false);
    this.StatusUpdateService.setSpinnerText('Stopped with errors!');
    this.StatusUpdateService.setStatusUpdate('Stopped with errors!');
    this.StatusUpdateService.setExperimentStatus(false);
    this.StatusUpdateService.setDisableButton(false);
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    this.logError(message,error);
    this.SharedService.saveForLog((new Date().toISOString()).concat(message).concat(errStackTrace));
    this.SharedService.downloadDebugFile(true,message);
  }

  /*
  Flushes input stream to make sure the longest possible response from device
  * is read completely. HACK
  * flag number indicates algorithm flow after recovery
  1. continue with preconditions
  2. continue with sampling
  3. For test mode only.
  4. Measure temperature and continue with sampling/precondition steps.
  default - go into standby mode after resetting potential to parking mode.

  gets index number to continue measurement or precondition segments correctly
  for readTemperature command and tempCommand is required
  */

  async cleanUpUnfinishedCommands(experimentId: number, experimentMethod: methodParam): Promise<void>{

    if(this.userStopsExperiment){
      this.userStopsExperiment = false;
      this.stopExperiment('Experiment Stopped')
      .then(()=>{
        this.StatusUpdateService.setLoadingSpinner(false);
        this.StatusUpdateService.setSpinnerText('Experiment stopped!');
        this.StatusUpdateService.setStatusUpdate('Experiment stopped!');
        this.StatusUpdateService.setExperimentStatus(false);
        this.StatusUpdateService.setDisableButton(false);
        this.StatusUpdateService.setDeviceIsBusy(false);
        this.experimentRunning = false;
        this.experimentFlag = false;
      })
      .catch((err)=>{
        this.userStopsExperiment = false;
        this.experimentRunning = false;
        this.experimentFlag = false;
        this.StatusUpdateService.setLoadingSpinner(false);
        this.StatusUpdateService.setSpinnerText('Experiment stopped with errors!');
        this.StatusUpdateService.setStatusUpdate('Experiment stopped with errors!');
        this.StatusUpdateService.setExperimentStatus(false);
        this.StatusUpdateService.setDisableButton(false);
        this.StatusUpdateService.setDeviceIsBusy(false);
        this.StatusUpdateService.setStoppedWithError(err);
        this.fatalErrorNeedsAttention('Experiment stopped with errors',err);
      });

    }
    else{
      return this.unsubscribeAll(0)
      .then(()=>{
        this.logError('unsubscribed all in clean up','');
        return this.disablePreviousTimers()
      })
      .then(()=>{
        return this.BtSerialService.clearBuffer();
      })
      .then(()=>{
        return this.flushInputStream(10000);
      })
      .then(()=>{
        return this.flushInputStream(5000);
      })
      .then(()=>{
        return this.flushInputStream(5000);
      })
      .then(()=>{
        return;
        // if(this.experimentFlag){
        //   return this.handleExperiment(null,this.experimentId,this.experimentMethod,false,this.postProcessingParamObj);
        // }
        // else{
        //   throw Error('Restart calibration');
        // }
      })
      .catch((e)=>{
        this.logError('Error in cleanUpUnfinishedCommands ',e);
        this.experimentRunning = false;
        this.experimentFlag = false;
        this.StatusUpdateService.setLoadingSpinner(false);
        this.StatusUpdateService.setSpinnerText('Experiment stopped with errors!');
        this.StatusUpdateService.setStatusUpdate('Experiment stopped with errors!');
        this.StatusUpdateService.setExperimentStatus(false);
        this.StatusUpdateService.setDisableButton(false);
        this.StatusUpdateService.setDeviceIsBusy(false);
        this.StatusUpdateService.setStoppedWithError(e);
        if(this.experimentFlag){
          this.fatalErrorNeedsAttention('Device communication could not be reset',e);
        }
        else{
          this.stopExperiment('Calibration Stopped with error');
          this.SharedService.showToast('Could not finsih calibration run, try again','middle');
          //this.fatalErrorNeedsAttention('Device communication could not be reset',e);
        }
      });
    }
  }

  /**
  **
  *   This method used by clean up unfinished commands to
  read and discard data. TODO change to use config file.
  **
  **/
  flushInputStream(timerForResponse): Promise<any>{


    let promise = new Promise((resolve,reject)=>{
      if(this.waitForDevice){
        reject('Device is busy: ' + (new Date()).toISOString());
        return;
      }
      //Will only execute if false.
      this.waitForDevice = true;
      this.BtSerialService.writeToDeviceAsChar(this.SharedService.deviceSetting.readData.Tx).then((written)=>{
        let timerForAlert = new Date();
        let checkForDelayTimer$ = Observable.timer(timerForResponse).subscribe((data)=>{
          observable.unsubscribe();
          this.waitForDevice = false;
          this.logError(' flushInputStream gets no response for command ' + this.SharedService.deviceSetting.readData.Tx + ' after ' + timerForResponse + 's','Resetting waitForDevice to false and exiting');
          reject(false);
        });
        this.arrayOfSubscriptions.push(checkForDelayTimer$);

        let observable = this.BtSerialService.subscribeRawData().subscribe((dt)=>{
          this.logError('Data from i/o stream as voyager data: ' + String(this.DatabaseService.convertToInteger(new Uint8Array(dt))),'');
          this.logError('Data from i/o stream as string: ' + String.fromCharCode.apply(null, new Uint8Array(dt)),'');
          timerForAlert = null;
          checkForDelayTimer$.unsubscribe();
          this.waitForDevice = false;
          observable.unsubscribe();
          resolve(true);
        },(subscribeError)=>{
          timerForAlert = null;
          this.SharedService.showToast('Device ' + this.SharedService.device.name + ' does not allow subscrition to raw data. Error Code: RDFD ');
          this.logError('Could not subscribe to raw data from device:',subscribeError);
          this.waitForDevice = false;
          reject(subscribeError);
        });
        this.arrayOfSubscriptions.push(observable);
      },(error) => {
        this.SharedService.showToast('Device ' + this.SharedService.device.name + 'throws error to write command: ' +this.SharedService.deviceSetting.readData.Tx + ' ** Error ** ' + error);
        this.logError('Could not write to device:  ', error);
        this.waitForDevice = false;
        reject(error);
      });
    });
    return promise;
  }

  /*
  Is called only when stop sampling is initiated.
  */

  switchOffVoltage(command){
    // let promise = new Promise((resolve,reject)=>{

      this.userUpdate = 'Setting device to standby';
      this.StatusUpdateService.setStatusUpdate(this.userUpdate);

    this.logError('PostMeasure "parking" started: ' + command + ' ' +  new Date().toISOString(),'');
    this.sendNewCommandsToDevice(command)
    .then((success)=>{
      //Voltage switched off.
      this.logError('Voltage set for parking ', new Date().toISOString());

      this.userStopsExperiment = false;
      this.experimentRunning = false;
      this.experimentFlag = false;
      this.StatusUpdateService.setLoadingSpinner(false);
      this.StatusUpdateService.setSpinnerText('Stopped Experiment!');
      this.StatusUpdateService.setExperimentStatus(false);
      this.StatusUpdateService.setDisableButton(false);
      this.StatusUpdateService.setStatusUpdate(null);
      this.StatusUpdateService.setDeviceIsBusy(false);

      return this.stopExperiment('Experiment stopped..')
      .catch((e) => {
        this.logError('Error switching off ',e);
        this.StatusUpdateService.setStoppedWithError(e);
        throw e;
      });
    })
    .catch((err)=>{
      this.logError('Voltage could not be set to parking mode! ',err);
      this.userStopsExperiment = false;
      this.experimentRunning = false;
      this.experimentFlag = false;
      this.StatusUpdateService.setLoadingSpinner(false);
      this.StatusUpdateService.setSpinnerText('Error Stopping Experiment!');
      this.StatusUpdateService.setExperimentStatus(false);
      this.StatusUpdateService.setDisableButton(false);
      this.StatusUpdateService.setStatusUpdate(null);
      this.StatusUpdateService.setDeviceIsBusy(false);
      this.StatusUpdateService.setStoppedWithError(err);
      this.fatalErrorNeedsAttention('Voltage could not be switched off',err);
    });
  }



  /**
  * Initializes global timer to kick in after waitTimeInMS to clean up Rx buffer and restart experiment.
  * @param waitTimeInMS: number Recommended time is >12000 ms
  *
  */

  startDeviceResponseDelayHandler(waitTimeInMS):void{
    this.timerForAlert = new Date();
    this.checkForDelayTimer$ = Observable.timer(waitTimeInMS).subscribe((data)=>{
      try{
        if(this.timerForAlert == null){
          this.logError(' I am here - do nothing ','');  //do Nothing
        }
        else{
          if(this.connectionDropped){
            //connection error handler will restart experiment, do nothing.
            this.logError('Connection dropped, connection error handler will continue experiment','');
          }
          else{
            throw Error('Device took too long to respond, go to clean up. ');
          }
        }
      }
      catch(error){
        this.logError(error,'');
        this.disablePreviousTimers();
        this.unsubscribeAll(0);

        this.waitForDevice = false;
        this.keepChecking = false;

        this.cleanUpUnfinishedCommands(this.experimentId,this.experimentMethod).then(()=>{
          if(this.experimentFlag){
            return this.handleExperiment(null,this.experimentId,this.experimentMethod,false,this.postProcessingParamObj);
          }
          else{
            this.fatalErrorNeedsAttention('Restart Experiment as there was an error!','Error-CA');
          }
        });

      }
    });
    this.arrayOfSubscriptions.push(this.checkForDelayTimer$);
  }

  /**
  * Should be called after startDeviceResponseDelayHandler to disable global timer.
  *
  */

  stopDeviceResponseDelayHandler():void{
    this.timerForAlert = null;
    if(this.checkForDelayTimer$){
      this.checkForDelayTimer$.unsubscribe();
      this.checkForDelayTimer$ = null;
    }
  }


  /**
  * Configures the BT device with new register settings and returns a timestamp when device is ready
  *
  * @remarks Uses config settings from SharedService
  *
  * @param command is a string of the format '4 157 3' with three values for three registers.
  * @return Date - a Date timestamp indicating the time BT Device was ready with new the register configurations
  *
  */


  async sendNewCommandsToDevice(command:string): Promise<Date>{
    let timeStamp = null;
    try{
      if(this.waitForDevice){
        throw Error('Device is busy: ' + (new Date()).toISOString());
      }
      this.waitForDevice = true;
      this.lastExecutedCommandInBuffer = this.SharedService.deviceSetting.setConfigMode.Tx;

      // set device to Config mode
      if(this.SharedService.deviceSetting.setConfigMode.TxAsString){
        await this.BtSerialService.clearBuffer();
        await this.BtSerialService.writeToDeviceAsChar(this.SharedService.deviceSetting.setConfigMode.Tx);
      }
      else{
        await this.BtSerialService.clearBuffer();
        await this.BtSerialService.writeToDevice(this.SharedService.deviceSetting.setConfigMode.Tx); //TODO bytes only if array of length 3..
      }
      this.logError('Tx to device ' + this.SharedService.deviceSetting.setConfigMode.Tx,'');
      if(this.SharedService.deviceSetting.setConfigMode.RxAsString){
        this.startDeviceResponseDelayHandler(14000);

        this.logError('Waiting for response to cmd: "' + this.SharedService.deviceSetting.setConfigMode.Tx,'');
        this.waitFunction(50);
        let reply = await this.readUntilDelimitter(this.SharedService.deviceSetting.responseDelimiter);
        // let reply = await this.readAsString();
        this.logError('Response ' + reply,'');
        this.stopDeviceResponseDelayHandler();
        if(!reply === (this.SharedService.deviceSetting.setConfigMode.Rx)){
          this.logError('Unexpected response: ' + reply,'');
          throw Error('Unexpected response for setting Config mode: ' + reply);
        }

      }
      else{
        this.startDeviceResponseDelayHandler(14000);//set above 12 secs to account for connection drop handler to kick in.
        this.logError('Waiting for response to cmd: "' + this.SharedService.deviceSetting.setConfigMode.Tx,'');
        let reply = await this.getResponseFromDevice(this.SharedService.deviceSetting.setConfigMode.Rx,this.SharedService.deviceSetting.setConfigMode.RxLength);
        this.logError('Response: ' + reply,'');
        // let reply = await this.readRawData(this.SharedService.deviceSetting.setConfigMode.RxLength)
        this.stopDeviceResponseDelayHandler();
      }


      // set registers of device.
      if(this.SharedService.deviceSetting.setRegisters.TxAsString){
        timeStamp = await this.BtSerialService.writeToDeviceAsChar(command);
      }
      else{
        this.lastExecutedCommandInBuffer = command;
        timeStamp = await this.BtSerialService.writeToDevice(command);
      }
      this.logError('Tx to device ' + command,'');
      this.logError('Rx as string? ', this.SharedService.deviceSetting.setRegisters.RxAsString);
      if(this.SharedService.deviceSetting.setRegisters.RxAsString){
        this.startDeviceResponseDelayHandler(14000);
        this.logError('Waiting for response to cmd: "' + command,'');
        this.waitFunction(50);
        let reply = await this.readUntilDelimitter(this.SharedService.deviceSetting.responseDelimiter);
        // let reply = await this.readAsString();
        this.logError('Response: ' + reply,'');
        this.stopDeviceResponseDelayHandler();
        if(!reply === (this.SharedService.deviceSetting.setRegisters.Rx)){
          this.logError('Unexpected response: ' + reply,'');
          throw Error('Unexpected response for setting Registers: ' + reply);
        }
      }
      else{
        this.startDeviceResponseDelayHandler(14000); //set above 12 secs to account for connection drop handler to kick in.
        this.logError('Waiting for response to cmd: "' + command,'');
        let reply = await this.getResponseFromDevice(this.SharedService.deviceSetting.setRegisters.Rx,this.SharedService.deviceSetting.setConfigMode.RxLength);
        this.logError('Response: ' + reply,'');
        this.stopDeviceResponseDelayHandler();
      }

      // this.logError('Tx to device: ' + command, '');
      this.waitForDevice = false;
      if(this.testing){
        this.testing = false;
        throw Error('testing ');
      }
      return timeStamp;

    }
    catch(error){
      this.logError('sendNewCommandsToDevice:error: ', error);
      this.waitForDevice = false;
      if(error === 'Timed out'){
        //Response delay handler will take care of it, do nothing.
        this.logError('Timed out','');
      }
      else{
        throw Error(error);
      }
    }
  }

  /*
  Reads data from bt device -
  * sends command to read data,
  * subscribes to raw data and checks bytelength to determine if full reading is obtained.
  * send bytesArray .

  //Depends on initialSamplingTime global objects.



  */

  //returns measurment object


  async readDataFromDevice(reading): Promise<measurement> {

    if(this.waitForDevice){
      this.logError('Should not happen! device is busy for readData AsBytes','')
      throw Error('Device is busy: ' + (new Date()).toISOString());
    }
    //this.logError('Proceed with readData: ' + reading,'');

    this.waitForDevice = true;
    let dataBuffer: number[] = [];
    let dataString: string = '';
    let timestamp: Date = null;



    try{
      // let bytes = await	this.BtSerialService.checkIfBytesAvailable();
      // if(bytes > 0){
      //   this.logError('Bytes available before read... ','read buffer content');
      //   let data = await this.readAsString();
      //   this.logError('Buffer: ' ,data);
      //   this.logError('Clear buffer','');
      // }

      await this.BtSerialService.clearBuffer();

      if(this.SharedService.deviceSetting.readData.TxAsString){
        timestamp = await this.BtSerialService.writeToDeviceAsChar(this.SharedService.deviceSetting.readData.Tx);
        // this.logError('timestamp returned : ' + timestamp,'');
      }
      else{
        timestamp = await this.BtSerialService.writeToDevice(this.SharedService.deviceSetting.readData.Tx);
      }
      this.logError('Tx to device ' + this.SharedService.deviceSetting.readData.Tx,'');

      if(this.SharedService.deviceSetting.readData.RxAsString){
        this.startDeviceResponseDelayHandler(14000);
        this.waitFunction(50);
        dataString = await this.readUntilDelimitter(this.SharedService.deviceSetting.responseDelimiter);
        // dataString = await this.readAsString();
        this.stopDeviceResponseDelayHandler();
        this.waitForDevice = false;
        return {dataBytesArray: dataBuffer, dataString: dataString, date: timestamp};
      }
      else{
        this.startDeviceResponseDelayHandler(14000);
        dataBuffer = await this.readRawData(this.SharedService.deviceSetting.readData.RxLength);
        this.stopDeviceResponseDelayHandler();
        this.waitForDevice = false;
        return {dataBytesArray: dataBuffer, dataString: dataString, date: timestamp};
      }
    }
    catch(error){
      this.SharedService.showToast('Device ' + this.SharedService.device.name + 'threw an error during data read: ** Error ** ' + error);
      this.logError('Could not read data from device:  ',error);
      this.waitForDevice = false;
      throw Error(error);
    }
  }

  /**
  * Check if a device is connected before disconnecting it
  * Error thrown if bluetooth plugin throws error.
  *
  */

  async disconnectDevice(): Promise<void>{
    //returns promise if connected and error if disconnected .
    try {
      await this.BtSerialService.connectionStatus();
    }
    catch(connected){
      if(this.connectionSubscription){
          this.connectionSubscription.unsubscribe();
      }
      this.logError('Check for older connection handles: NONE found','');
      return;
    }

    //Previous connection detected, disconnect
    try{
      if(this.connectionSubscription){
        this.connectionSubscription.unsubscribe();
      }
      await this.BtSerialService.disconnectDevice();
      this.logError('Device disconnected successfully','');
      return;
    }
    catch(error){
      this.logError('Device could not be disconnected!','');
      throw(error);
    }
  }

  /**
  * All subscriptions unsubscribed from to cleanup.
  *
  */
  unsubscribeAll(delay){
    let promise = new Promise((resolve,reject)=>{
      setTimeout(()=>{
        var noOfSubscriptions = this.arrayOfSubscriptions.length;
        if(noOfSubscriptions > 0 ){
          for(var i=0;i<noOfSubscriptions;i++){
            this.arrayOfSubscriptions[i].unsubscribe();
          }
          this.arrayOfSubscriptions = []; //reset the array here.
          this.waitForDevice = false;
        }
        resolve(true);

      },delay);
    });
    return promise;
  }




  /**
  * Save logs for debug file.
  */
  logError(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    console.log('DataReaderService: ' + message + ' ' + errStackTrace);
    this.SharedService.saveForLog((new Date().toISOString() + ': DataReaderService: ').concat(message).concat(errStackTrace));
  }


}
