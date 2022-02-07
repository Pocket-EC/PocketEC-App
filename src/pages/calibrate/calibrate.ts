import { Component,NgZone } from '@angular/core';
import { IonicPage, NavController,NavParams, AlertController,LoadingController } from 'ionic-angular';
import { SharedserviceProvider } from '../../providers/sharedservice/sharedservice';
import { DataReaderService } from '../../providers/datareaderservice/datareaderservice';
import { DatabaseProvider } from '../../providers/database/database';
import { DataProcessingProvider } from '../../providers/dataprocessingservice/dataprocessingservice';
import { StatusUpdateProvider } from '../../providers/statusupdateservice/statusupdateservice';



/**
 * Generated class for the CalibratePage page.
 *
 *
 */



@IonicPage()
@Component({
  selector: 'page-calibrate',
  templateUrl: 'calibrate.html',
})
export class CalibratePage {
  type: string = 'new'; //denotes the segment type on view.
  offset: number = 0; //Required user defined field holding either quantitative or qualitative offset.
  concentration1: number = 0; //Concentration of offset/std1
  concentration2: number = null; //is x1 Concentration of std2
  calibrant: number = null; //y1: number = null; // coordinates of point 2 for calculating slope. finalCharge.
  name: string = 'new';

  concentration: number = null; //Required user defined field holding concentration of analyte
  chosenOffset: calibrationObj = null; //Offset set by user from previous measured calibrations.
  y1: number = null; // coordinates of point 2 for calculating slope. finalCharge.
  x1: number = null; // coordinates of point 2 for calculating slope. concentration.
  calibrations= []; //holds all old calibrations. refreshed from Database on page load.
  storedCalibration: calibrationObj = null;

  includeFirstMeasure: boolean = true;
  //Parameters obtained from navParams
  listOfMeasures: Array<techniqueParam>;
  stepsArrayForCalibrations: Array<techniqueParam> = [];

  postProcessingParamObj: postProcessingParams = {
                            databaseRowid: null,
                            unitOfCharge: 'mC',
                            offset: 0,
                            sensitivity: 1,
                            unitDependentOnSensitivity:' g/L',
                            includeFirstMeasure: false,
                            algorithm: null
                          }
  algorithm: {
                    index:number, //unique id
                    step1Description:string,
                    step1Index:number,
                    step2Description:string,
                    step2Index:number,
                    description:string
                  };
  page: string = null; //name of page that calls calibration

  stopCalibrationRun: boolean = false;
  data: experimentDataObject = {
                            length: 0,
                            dataArray: [],
                            chartDateArray: [],
                            currentArray: [],
                            temperatureArray: [],
                            stepIdArray: [],
                            noOfMeasurementsPerStepArray: [],
                            stepStartTimeArray: [],
                            experimentId: null,
                            method: null
                          };

  //properties for showing missing values
  showMissingCoordinatesError: boolean = false;
  //properties for showing correct input fields to user
  calcOffset: boolean = false;
  slopeFromOffset: boolean = false;
  slopeFromSecondPoint: boolean = false;

  //properties for showing measurement progress
  calibrationRunning: boolean = false; //controls start/stop button.
  disableButton: boolean = false; //controls start/stop button.
  calibrationInProgress: boolean = false;
  showLoadingSpinner = false; //boolean to show device connect/disconnect in progress
  spinnerText: string = ''; //text to accompany loading spinner icon.
  statusUpdateForUser: string;//set by StatusUpdateService subscription  - gives
  exptStartTime: string; //set by StatusUpdateService subscription
  lastSampledTime: string; //set by SharedService subscription

  currentArray: Array<number> = [];



  constructor(public navCtrl: NavController,
    public navParams: NavParams,
    public alert: AlertController,
    public loadingCtrl: LoadingController,
    private SharedService: SharedserviceProvider,
    private DataReaderService: DataReaderService,
    private DatabaseService: DatabaseProvider,
    private DataProcessingService: DataProcessingProvider,
    public StatusUpdateService: StatusUpdateProvider,
    private ngZone: NgZone) {
      //subscribe to status updates
      this.statusUpdateSubscriptions();
  }

  ngOnInit() {
    this.type = 'list';
  }

  ionViewWillEnter(){
    try{
      this.page = this.navParams.get('page');
      this.listOfMeasures = this.navParams.get('listOfMeasures');
      this.logError('printing list of measures length: ' + this.listOfMeasures.length,'');
      this.postProcessingParamObj = this.navParams.get('postProcessingParamObj'); //
      this.algorithm = this.postProcessingParamObj.algorithm;
      this.logError('Algorithm: ' + JSON.stringify(this.algorithm),'');
      this.includeFirstMeasure = this.navParams.get('includeFirstMeasure');
      this.createStepsArray();
      this.getListOfCalibrations();
    }
    catch(err){
      this.fatalErrorNeedsAttention('Some parameters required for the Calibration Page could not be loaded',err);
    }
  }

  ionViewWillLeave(){
    //Update offset and sensitivity in page that called Calibration - Analysis/Home

    if(this.page === 'home'){
      this.navCtrl.getPrevious().data.postProcessingParamObj = this.postProcessingParamObj;
    }
    else{
      this.navCtrl.getPrevious().data.postProcessingParamObj = this.postProcessingParamObj;
    }
  }


  /**
  * Subscribe to parameters that report on experiment/calibration run status.
  *
  *
  */

  statusUpdateSubscriptions(){
    this.StatusUpdateService.subscribeToExperimentStatus().subscribe((experimentStatus)=>{
      this.ngZone.run(() => {
        //default value is fault. set in StatusUpdateService
        this.calibrationRunning = experimentStatus;
      });
    });

    this.StatusUpdateService.subscribeToShowSpinner().subscribe((show)=>{
      this.ngZone.run(() => {
        this.showLoadingSpinner = show;
      });
    });

    this.StatusUpdateService.subscribeToSpinnerText().subscribe((text)=>{
      this.ngZone.run(() => {
        this.spinnerText = text;
      });
    });

    this.StatusUpdateService.subscribeToButtonDisableFlag().subscribe((disable)=>{
      this.ngZone.run(() => {
        this.disableButton = disable;
      });
    });

    this.StatusUpdateService.subscribeToStatusUpdate().subscribe((update)=>{
      this.ngZone.run(() => {
        this.statusUpdateForUser = update;
      });
    });

    this.StatusUpdateService.subscribeToLastSampledTime().subscribe((timeStamp)=>{
      this.ngZone.run(() => {
        this.lastSampledTime = timeStamp.toLocaleString();
      });
    });

    this.StatusUpdateService.subscribeToExptStartTime().subscribe((time)=>{
      this.ngZone.run(() => {
        this.exptStartTime = time;
      });
    });

    this.StatusUpdateService.subscribeToStoppedWithError().subscribe((error)=>{
      this.StatusUpdateService.setStatusUpdate('Calibration Failed');
      this.calibrationRunning = false;
      this.fatalErrorNeedsAttention('Measurement failed',error);
    });

  }

  /**
  * Check if all required fields have values. Is called before processing
  *
  */


  async validateFields():Promise<boolean>{
    let validating = this.loadingCtrl.create({
      content: 'Validating fields...'
    });
    try{
    await validating.present();
    // .then(()=>{
        if(this.concentration2 == null ||
          this.concentration2 == undefined){
            validating.dismiss();
            this.SharedService.showToast('Enter a valid value for concentration','middle');
            // this.unitOfChargeViewChild.setFocus();
            return false;
        }
        this.logError('concentration before blank check: ',this.concentration2);
        //check if concentration field is blank.
        let tempStr: string = String(this.concentration2);
        if(tempStr.length == 0){
          validating.dismiss();
          this.SharedService.showToast('Enter a valid value for concentration','middle');
          // this.unitOfChargeViewChild.setFocus();
          return false;
        }

        if(isNaN(+this.concentration2)){
          this.SharedService.showToast('Enter a valid value for concentration','middle');
          validating.dismiss();
          return false;
        }

        if(this.name == null || this.name.length == 0){
          this.SharedService.showToast('Please enter a name to save the calibration','middle');
          validating.dismiss();
          return false;
        }

        //Check if offset has a value, if not, algorithm requires x1 and y1.

        if(this.offset == null || this.offset == undefined){
          this.SharedService.showToast('Please enter a value for offset to proceed','middle');
          validating.dismiss();
          return false;
        }
        else{
          //check if its blank.
          let tempStr = String(this.offset);
          if(tempStr.length == 0){
            this.SharedService.showToast('Please enter a value for offset to proceed','middle');
            validating.dismiss();
            return false;
          }
        }
        if(this.concentration2 == null || this.concentration2 == undefined){
          this.SharedService.showToast('Please enter values for Calibrant to proceed','middle');
          validating.dismiss();
          return false;
        }
        else{
          let tempStr = String(this.concentration2);
          if(tempStr.length == 0){
            this.SharedService.showToast('Please enter a value for Calibrant to proceed','middle');
            validating.dismiss();
            return false;
          }
        }
        if(this.calibrant == null || this.calibrant == undefined){
          this.SharedService.showToast('Please enter values for Calibrant to proceed','middle');
          validating.dismiss();
          return false;
        }
        else{
          let tempStr = String(this.calibrant);
          if(tempStr.length == 0){
            this.SharedService.showToast('Please enter a value for Calibrant to proceed','middle');
            validating.dismiss();
            return false;
          }
        }


        validating.dismiss();
        return true;
    }
    catch(error){
      this.logError('Error in validateFields',error);
      throw error;
    }
  }


  /**
  *  Measure Offset
  *
  */

  async measureOffset():Promise<void> {

    try{
      let finalCharge = await this.runMeasurement();

      if(finalCharge == null){
        throw Error('Final Charge could not be calculated');
      }

      this.logError('Final charge calculation finished','');
      this.offset =  parseFloat((finalCharge*1).toPrecision(6));

    }
    catch(err){
      this.fatalErrorNeedsAttention(err,err);
    }
  }


  async measureCalibrationStandard(){
    try{

      let finalCharge = await this.runMeasurement();

      if(finalCharge == null){
        throw Error('Final Charge could not be calculated');
      }
      this.logError('Final charge calculation finished','');
      this.calibrant =  parseFloat((finalCharge*1).toPrecision(6));
    }
    catch(err){
      this.fatalErrorNeedsAttention(err,err);
    }
  }


  /**
  *  Subroutine for running calibration measurements.
  *
  */

  async runMeasurement():Promise<number> {

    try{

      if(this.stepsArrayForCalibrations == null || this.stepsArrayForCalibrations == undefined || this.stepsArrayForCalibrations.length == 0){
        this.SharedService.presentAlert('Info','Could not detect steps for calibration','Dismiss');
        return;
      }
      if(this.StatusUpdateService.deviceIsBusy){
        this.SharedService.presentAlert('Info','Device is currently busy','Dismiss');
        return;
      }
      this.showMissingCoordinatesError = false;
      this.StatusUpdateService.setDeviceIsBusy(true);
      this.StatusUpdateService.setDisableButton(true);
      this.StatusUpdateService.setLoadingSpinner(true);
      this.StatusUpdateService.setSpinnerText('Starting measurement..');
      this.StatusUpdateService.setStatusUpdate('Measuring..');
      this.StatusUpdateService.setExperimentStatus(true);
      this.calibrationRunning = true;
      this.stopCalibrationRun = false;
      this.SharedService.samplingPaused(false);

      let dataForProcessing: experimentDataObject = {
                                length: 0,
                                dataArray: [],
                                chartDateArray: [],
                                currentArray: [],
                                temperatureArray: [],
                                stepIdArray: [],
                                noOfMeasurementsPerStepArray: [],
                                stepStartTimeArray: [],
                                experimentId: null,
                                method: null
                              };

      this.ngZone.run(()=>{
        this.StatusUpdateService.setExperimentStatus(true); //controls button view for start/stop
        this.calibrationInProgress = true; //let user view status..
      });

      let arrayOfStepData = await this.DataReaderService.startCalibrationRun(this.stepsArrayForCalibrations);
      if(arrayOfStepData == null || arrayOfStepData == undefined){
        if(this.stopCalibrationRun){
          this.logError('Calibration stopped by user','');
          throw Error('Calibration stopped by user');
        }
        else{
          throw Error('Null data returned!');
        }
      }
      dataForProcessing = this.processMeasuredData(arrayOfStepData);

      let processedResult = this.DataProcessingService.getSumOfCurrentIntegratedPerStep(dataForProcessing,this.listOfMeasures,this.includeFirstMeasure);
      let sumOfCurrentIntegratedArray = processedResult.correctedSumOfCurrentIntegratedArray;
      let finalCharge: number = null;


      if(sumOfCurrentIntegratedArray[0] == null || sumOfCurrentIntegratedArray[0] == undefined){
        throw Error('Could not find step1 currentIntegrated in array');
      }

      if(sumOfCurrentIntegratedArray[0].stepId != this.algorithm.step1Index){
        throw Error('Could not find step1 currentIntegrated');
      }
      else{
        if(this.algorithm.step2Index == null){
          finalCharge = sumOfCurrentIntegratedArray[0].value;
        }
        else{
          if(sumOfCurrentIntegratedArray[1] == null || sumOfCurrentIntegratedArray[1] == undefined){
            throw Error('Could not find step2 currentIntegrated in array');
          }
          if(sumOfCurrentIntegratedArray[1].stepId != this.algorithm.step2Index){
            throw Error('Could not find step2 currentIntegrated');
          }
          else{
            finalCharge = sumOfCurrentIntegratedArray[0].value - sumOfCurrentIntegratedArray[1].value;
          }
        }
      }

      this.StatusUpdateService.setStatusUpdate('Finished: ');
      this.StatusUpdateService.setLoadingSpinner(false);
      this.StatusUpdateService.setExperimentStatus(false);
      this.StatusUpdateService.setDisableButton(false);
      this.StatusUpdateService.setDeviceIsBusy(false);
      return finalCharge;
    }
    catch(err){
      if(this.stopCalibrationRun){
          this.SharedService.showToast('Calibration stopped by user');
          this.logError('Calibration stopped by user.. ',err);
      }
      else{
        this.StatusUpdateService.setExperimentStatus(false);
        this.StatusUpdateService.setDisableButton(false);
        this.StatusUpdateService.setStatusUpdate('Calibration finished: with error');
        this.StatusUpdateService.setLoadingSpinner(false);
        this.StatusUpdateService.setDeviceIsBusy(false);
        this.fatalErrorNeedsAttention(err,err);
      }
    }
  }

  /**
  * Calibrate
  */

  async calibrate():Promise<void> {
    let storedCalibration: calibrationObj = null;
    try{
      let proceedWithCalibration = await this.validateFields();
      if(!proceedWithCalibration) return;

      // let slope = (y2-y1)/(x2-x1);
      let slope = (this.calibrant - this.offset)/(this.concentration2 - this.concentration1);
      // y = mx + b  therefore  b = y - mx;

      this.postProcessingParamObj.offset = this.offset;
      this.postProcessingParamObj.sensitivity = parseFloat((slope*1).toPrecision(6));

      let newCalibration = {
        name: this.name,
        concentration: this.concentration2,
        offset: this.postProcessingParamObj.offset,
        sensitivity: this.postProcessingParamObj.sensitivity,
        unit: this.postProcessingParamObj.unitDependentOnSensitivity,
        algorithmDescription: this.algorithm.description,
        userId: this.SharedService.userId,
        deviceId: this.SharedService.deviceId
      };

      storedCalibration = await this.DatabaseService.createNewCalibration(newCalibration);
      //storedCalibration = await this.DatabaseService.createNewCalibration(this.name,this.concentration1,this.offset, this.postProcessingParamObj.unitDependentOnSensitivity,this.algorithm.description,this.SharedService.userId,this.SharedService.deviceId,slope);


       this.calibrations.unshift(storedCalibration);
       this.type = 'list'; //change to listview.
       this.SharedService.presentAlert('INFO','Calibration saved as ' + this.name,'DIMISS');

    }
    catch(err){
      this.fatalErrorNeedsAttention(err,err);
    }
  }


  /**
  * Get measured data and process to create experimentDataObject for processing.
  *
  */

  processMeasuredData(arrayOfStepData: stepData[]): experimentDataObject{
    try{
      let reading;
      let measurementRef;
      this.currentArray = [];
      let dataForProcessing: experimentDataObject = { length: 0,
                        dataArray: [],
                        chartDateArray: [],
                        currentArray: [],
                        stepIdArray: [],
                        temperatureArray: [],
                        noOfMeasurementsPerStepArray: [],
                        stepStartTimeArray: [],
                        experimentId: null,
                        method: null
                      };

      for(let j=0; j< arrayOfStepData.length; j++){
        let stepRef = arrayOfStepData[j];
        let length = stepRef.data.length;

        for(var i=0;i<(length);i++){
          measurementRef = stepRef.data[i];
          let date = measurementRef.date.toISOString();
          if(this.SharedService.deviceSetting.readData.RxAsString){
            reading = measurementRef.dataString;
          }
          else{
            reading = String(this.DatabaseService.convertToInteger(measurementRef.dataBytesArray));
          }
          dataForProcessing.dataArray.push(reading);
          dataForProcessing.chartDateArray.push(date);
          dataForProcessing.stepIdArray.push(this.stepsArrayForCalibrations[j].stepNumber);
          dataForProcessing.noOfMeasurementsPerStepArray.push(length);
          dataForProcessing.stepStartTimeArray.push(stepRef.startTime.toISOString());
          dataForProcessing.currentArray.push(((reading as any) - (stepRef.zeroOffset as any) ) * (stepRef.scalingFactor as any));
        }
        dataForProcessing.length = dataForProcessing.length + length;
      }
      return dataForProcessing;
    }
    catch(error){
      this.logError('Error processing Data ' + JSON.stringify(error,Object.getOwnPropertyNames(error)),error);
      throw error;
    }

  }

  stopCalibration(){
    this.DataReaderService.stopCalibrationRun();
    this.calibrationRunning = false;
    this.stopCalibrationRun = true;
    // this.StatusUpdateService.setLoadingSpinner(true);
    // this.StatusUpdateService.setSpinnerText('Stopping calibration..');
    // this.StatusUpdateService.setDisableButton(true);
  }



  /**
  * Is called when user changes view between new calib and list all calibs.
  * @param {"_config":{},"_elementRef":{},"_renderer":{},"_componentName":"segment","_mode":"md","_defaultValue":null,"_form":null,"_item":null,"_ngControl":{},"_isFocus":false,"_disabled":false,"_debouncer":{},"_init":true,"_initModel":true,"ionFocus":{},"ionChange":{},"ionBlur":{},"_value":"list","_buttons":{}}
  */
  segmentChanged(event): void {

    if(event.value === 'list'){
      // this.logError('Segment changed to list', event);
      this.ngZone.run(()=>{
        this.calibrationInProgress = false;
      });
    }
    else{
      this.ngZone.run(()=>{
        this.calibrationInProgress = true;
      });
    }
  }

  /**
  * User can set offset from pre measured calibrations.
  * @param calibrationObj
  *
  */
  setOffset():void{
    this.logError('setting offset from calib object: ' + JSON.stringify(this.chosenOffset),'');
    this.offset = +this.chosenOffset.offset;
    this.concentration1 = 0;
  }


  /**
  * Create an array list of steps used in the algorithm. Size should always be 2.
  * This is needed for calculating the final charge as specified in
  *
  * Requires global parameters
    listOfMeasures
    algorithm
    sets new values for global parameter stepsArrayForCalibrations
  */


  createStepsArray(): void{

    this.logError('Printing no in list of measures: '+ this.listOfMeasures.length,'');
    if(this.listOfMeasures != null && this.listOfMeasures.length != 0){
      for(let i=0; i< this.listOfMeasures.length; i++){
        // if(this.listOfMeasures[i].databaseRowid == this.algorithm.step1Index){
        if(this.listOfMeasures[i].stepNumber == this.algorithm.step1Index){
          this.stepsArrayForCalibrations.push(this.cloneStep(this.listOfMeasures[i]));
          this.logError('Copied to stepsArrayForCalibrations: '+ JSON.stringify(this.listOfMeasures[i]),'');
          continue;
        }
        // if(this.listOfMeasures[i].databaseRowid == this.algorithm.step2Index){
        if(this.listOfMeasures[i].stepNumber == this.algorithm.step2Index){
          this.stepsArrayForCalibrations.push(this.cloneStep(this.listOfMeasures[i]));
          this.logError('step2 Copied to stepsArrayForCalibrations: '+ JSON.stringify(this.listOfMeasures[i]),'');
          continue;
        }
      }
      this.logError('Printing no in stepsArrayForCalibrations: '+ this.stepsArrayForCalibrations.length,'');
      if(this.stepsArrayForCalibrations.length == 0){
        this.fatalErrorNeedsAttention('Cannot proceed with calibration without any calibration steps',Error('Error calibrating'));
      }
    }
    else{
      this.fatalErrorNeedsAttention('Cannot proceed with calibration without any measure steps',Error('Error calibrating'));
    }
  }

  /**
  *Creates a deep copy of the step/technique object of type techniqueParam
  */

  cloneStep(technique:techniqueParam): techniqueParam{
    if(technique == null){
      return <techniqueParam>{};
    }
    else{
      let newTechnique =  { ...technique,
          potential: {...technique.potential,
                      intZ: {...technique.potential.intZ}
                    },
          gain: {...technique.gain,
                    rLoad: {...technique.gain.rLoad}
                }
          };
      return newTechnique;
    }
  }


  /**
  * Refresh global parameter calibrations with new list from database. user and device specific
  *
  */
  async getListOfCalibrations():Promise<void>{
    try{
      this.calibrations = await this.DatabaseService.getListOfCalibrations(this.SharedService.userId,this.SharedService.deviceId);
      this.logError('Printing no. of calibs ' + this.calibrations.length,'');
    }
    catch(err){
      throw err;
    }
  }

  /**
  * Called when user chooses a calibration. Sets the postProcessingParamObj in Analysis view before going back to it.
  * calibration can still be running..
  * IMPORTANT: only works if calibration always called from Analysis Component.
  */

  chooseCalibration(calib){
    try{
      this.logError('Calib chosen: ',calib);
      this.postProcessingParamObj.sensitivity=calib.sensitivity;
      this.postProcessingParamObj.offset = calib.offset;
      this.postProcessingParamObj.unitDependentOnSensitivity = calib.unit;
      this.navCtrl.getPrevious().data.postProcessingParamObj = this.postProcessingParamObj;
      this.navCtrl.pop();
    }
    catch(e){
      this.logError('Error when choosing calib: ',e);
      this.SharedService.presentAlert('Error',e,'Dismiss');
    }
  }

  /**
  * Confirm delete action by user before performing irreversible delete action.
  * @param calibrationObj
  */

  confirmBeforeDeletion(calib): void{
    let confirmAlert = this.alert.create({
      title: 'WARNING',
      message: 'Delete calibration: ' + calib.name + ' recorded on: ' + calib.dateCreated + '?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            this.logError('Do not delete!','');
          }
        },
        {
          text: 'Continue',
          handler: () => {
            this.deleteChosenCalibration(calib);
          }
        }
      ]
    });
    confirmAlert.present();
  }

  /**
  * Delete method passed as param as long as its not the method currently being edited
  * @param methodParam object
  *
  */

  async deleteChosenCalibration(calib:calibrationObj): Promise<void>{
    try{
      if(calib.calibId == null || calib.calibId == undefined){
        throw Error('Unique identifier missing in Calibration');
      }

      await this.DatabaseService.deleteCalibration(calib.calibId);
      this.logError('Deleted calibration with id: ' + calib.calibId +' from the database','');
      let index = this.calibrations.indexOf(calib);
      if(index > -1){
        this.calibrations.splice(index, 1);
      }
      else{
        throw Error('Calibration could not be found in the list!');
      }
      this.SharedService.showToast('Calibration ' + calib.name + ' deleted');
    }
    catch(err){
      this.logError('error deleting calibration: ',err);
      this.SharedService.presentAlert('Error',err,'Dismiss');
    }
  }

  /*
  Called in unrecoverable cases - sampling will be stopped
  */
  fatalErrorNeedsAttention(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    this.logError(message,error);
    this.SharedService.presentAlert('Fatal Error',message,'DISMISS');
    this.SharedService.saveForLog((new Date().toISOString()).concat(message).concat(errStackTrace));
    this.SharedService.downloadDebugFile(true);
  }

  logError(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    console.log('CalibratePage: ' + message + ' ' + errStackTrace);
    this.SharedService.saveForLog((new Date().toISOString() + ': CalibratePage: ').concat(message).concat(errStackTrace));
  }
}
