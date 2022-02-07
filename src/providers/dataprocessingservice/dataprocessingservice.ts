
import { Injectable } from '@angular/core';
import { SharedserviceProvider } from '../../providers/sharedservice/sharedservice';

/*
  Generated class for the ProvidersDataProcessingProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class DataProcessingProvider {

  constructor(public SharedService: SharedserviceProvider) {

  }
  /**
  * NOT USED
  * copid from Analysis
  */
  process(data: experimentDataObject,currentArray,stepsObjectForAnalysis:stepsObject,algorithm,stepsArray: techniqueParam[],includeFirstMeasure: boolean){
    try{


      let currentIntegrated: number = 0;
      let sumOfCurrentPerStep: number = 0;
      let sumOfCurrentIntegratedPerStep: number = 0;
      let timeDiff: number = 0;
      let stepStartTime: string = '';
      let noOfMeasurementsPerStep: number = 0;
      let noOfMeasurementsPerStepArray = [];
      let currentIntegratedArray = []; //Stores chargePerStep (current * time interval betw two readings)
      let sumOfCurrentArray = []; // sum of current in each step
      let sumOfCurrentIntegratedArray = []; //sum of integrated current in each step.
      let datetimeForCurrentArray = [];//the last data's datetime is stored for plotting result.
      let finalChargeArray = []; //algorithm using multiple steps used for calculating final charge.

      let timeDiffArray = [];

      //Iterate the first index of data separately


      this.logError('-----  ++++++++ ------- ','');
      this.logError('Start calc. current & integ current ','');
      this.logError('-----  ++++++++ ------- ','');

      //First entry treated separately to use the stepStartTime

      let previousStepId = data.stepIdArray[0];
      let previousStepTimestamp = data.chartDateArray[0];
      if(data.noOfMeasurementsPerStepArray[0] != undefined && data.noOfMeasurementsPerStepArray[0] != null){
        noOfMeasurementsPerStep = data.noOfMeasurementsPerStepArray[0];
        this.logError('Iteration no. 1 ' + noOfMeasurementsPerStep,'');
      }
      else{
        this.logError('THIS SHOULD NOT HAPPEN','');
        this.logError('Could not determine noOfMeasurementsPerStep for next batch of step data','');
        throw Error('Could not determine noOfMeasurementsPerStep for next batch of step data');
      }

      if(data.stepStartTimeArray[0] != undefined && data.stepStartTimeArray[0] != null){
        stepStartTime = data.stepStartTimeArray[0];
      }
      else{
        this.logError('THIS SHOULD NOT HAPPEN ' + data.stepStartTimeArray[0],'');
        this.logError('Could not determine step start time for next batch of step data','');
        throw Error('Could not determine step start time for next batch of step data');

      }

      timeDiff = (new Date(data.chartDateArray[0]).getTime())  - (new Date(stepStartTime).getTime()) ;
      timeDiffArray.push(timeDiff);

      currentIntegrated = (timeDiff)  * currentArray[0]/1000;
      currentIntegratedArray.push(currentIntegrated);

      if(includeFirstMeasure){
        this.logError('Iteration no. 1' + ' Adding to sumOfCurrent: ' + sumOfCurrentPerStep + ' value: ' + currentArray[0],'');
        sumOfCurrentPerStep = currentArray[0];
        sumOfCurrentIntegratedPerStep =  currentIntegrated;
      }

      let counter = 1;
      previousStepTimestamp = data.chartDateArray[0];

      for(let i=1;i<data.dataArray.length;i++){
        if(counter < noOfMeasurementsPerStep){
          //this.logError('Iteration no. ' + (i+1) + ' Printing no of data per step: ' + data.noOfMeasurementsPerStepArray[i] + ' stepId: ' + data.stepIdArray[i] ,'');
          //this.logError('timeDiff. ' + data.chartDateArray[i] + ' - ' + previousStepTimestamp,'');
          timeDiff = (new Date(data.chartDateArray[i]).getTime())  - (new Date(previousStepTimestamp).getTime()) ;

          //currentIntegrated = (timeDiff) * 24 * 3600 * currentArray[i];
          currentIntegrated = (timeDiff)  * currentArray[i]/1000;
          //this.logError('timediff: ' + timeDiff + ' current: ' + currentArray[i] + ' integrated: ' + currentIntegrated,'');
          currentIntegratedArray.push(currentIntegrated);
          timeDiffArray.push(timeDiff);



          this.logError('Iteration no. ' + (i+1) + ' Adding to sumOfCurrent: ' + sumOfCurrentPerStep + ' value: ' + currentArray[i],'');
          sumOfCurrentPerStep = sumOfCurrentPerStep + currentArray[i];
          sumOfCurrentIntegratedPerStep = sumOfCurrentIntegratedPerStep + currentIntegrated;
          //store this iteration stepId for the next iteration.
          this.logError('previous stepid: ' + data.stepIdArray[i],'');
          previousStepId = data.stepIdArray[i];
          previousStepTimestamp = data.chartDateArray[i];
          counter++;
        }
        else{

          //this.logError(noOfMeasurementsPerStep,'');
          this.logError('Iteration no. ' + (i+1) + ' Adding to array the sumTotal   ' + sumOfCurrentPerStep,'');
          datetimeForCurrentArray.push(previousStepTimestamp);
          sumOfCurrentArray.push(sumOfCurrentPerStep);
          sumOfCurrentIntegratedArray.push({stepId: previousStepId, value: sumOfCurrentIntegratedPerStep});
          noOfMeasurementsPerStepArray.push(noOfMeasurementsPerStep);


          if(data.noOfMeasurementsPerStepArray[i] != undefined || data.noOfMeasurementsPerStepArray[i] != null){

            noOfMeasurementsPerStep = data.noOfMeasurementsPerStepArray[i];
            this.logError('next step noOfMeasurementsPerStep obtained: ' + noOfMeasurementsPerStep,'');
          }
          else{
            this.logError('THIS SHOULD NOT HAPPEN','');
            throw Error('Could not determing noOfMeasurementsPerStep for next batch of step data');
          }
          if(data.stepStartTimeArray[0] != undefined && data.stepStartTimeArray[0] != null){
            previousStepTimestamp = data.stepStartTimeArray[i];
            this.logError('previous step timeStamp: ' + previousStepTimestamp,'');
          }
          else{
            this.logError('THIS SHOULD NOT HAPPEN','');
            throw Error('Could not determine step start time for next batch of step data');
          }
          //this.logError('timeDiff. ' + data.chartDateArray[i] + ' - ' + previousStepTimestamp,'');
          timeDiff = (new Date(data.chartDateArray[i]).getTime())  - (new Date(previousStepTimestamp).getTime()) ;
          currentIntegrated = (timeDiff)  * currentArray[i]/1000;
          currentIntegratedArray.push(currentIntegrated);
          timeDiffArray.push(timeDiff);

          if(includeFirstMeasure){
            sumOfCurrentPerStep = currentArray[i];
            sumOfCurrentIntegratedPerStep = currentIntegrated;
          }
          else{
            sumOfCurrentPerStep = 0;
            sumOfCurrentIntegratedPerStep = 0;
          }
          counter = 1;
          //store this iteration stepId for the next iteration.
          previousStepId = data.stepIdArray[i];
          previousStepTimestamp = data.chartDateArray[i];

        }

      }
      // Add the last iteration sum to the arrays.
      this.logError(' Adding to array the sumTotal   ' + sumOfCurrentPerStep,'');
      datetimeForCurrentArray.push(previousStepTimestamp);
      sumOfCurrentArray.push(sumOfCurrentPerStep);
      sumOfCurrentIntegratedArray.push({stepId: previousStepId, value: sumOfCurrentIntegratedPerStep});
      noOfMeasurementsPerStepArray.push(noOfMeasurementsPerStep);


      let finalCharge: number = 0;

      let step1 = algorithm.step1Index;
      let step2 = algorithm.step2Index;

      for(let i=0;i<sumOfCurrentIntegratedArray.length;i++){
        this.logError(' Iteration: ' + i + ' stepIdofValue: ' + sumOfCurrentIntegratedArray[i].stepId + ' algorithmStepId: ' + step1,'');
        if(sumOfCurrentIntegratedArray[i].stepId == step1){
          this.logError('This value is step1, FIND step2 data if available','');
          if(step2 == null){
            finalCharge = sumOfCurrentIntegratedArray[i].value;
            finalChargeArray.push(finalCharge);
            this.logError('Step2 is null: So Finalcharge: ' + sumOfCurrentIntegratedArray[i].value ,'');
            break;
          }
          else{
            if(sumOfCurrentIntegratedArray[i+1] != undefined || sumOfCurrentIntegratedArray[i+1] != null){

              if(sumOfCurrentIntegratedArray[i+1].stepId == step2){
                finalCharge = sumOfCurrentIntegratedArray[i].value - sumOfCurrentIntegratedArray[i+1].value;
                this.logError('Next value is NOT null and is Step2: Finalcharge: ' + sumOfCurrentIntegratedArray[i].value + ' - ' + sumOfCurrentIntegratedArray[i+1].value ,'');
                finalChargeArray.push(finalCharge);
                break;
              }
              else{
                this.logError('Next value is not null but is NOT Step2: Go to next step','');
                this.logError('Cannot happen!','');
                throw Error('Could not find step2 in array');
                // finalCharge = result=0;
              }
            }
            else{
              this.logError('Next value is Null: Finalcharge: 0','');
              throw Error('Could not find step2 in array');
            }
          }
        }
        else{
          this.logError('This value is not step1, finalCharge=0','');
          throw Error('Could not find step1 in array');
        }
      }
      this.logError('**********       Finished processing data       *************','');
      return finalChargeArray;
    }
    catch(err){
      throw err;
    }
  }
  /**
  * Calculates Total current per step.
  * Step 1: calculate integrated current for each data point.
  *  Is product of current and elapsed time between two measurements.
  * First data point and last data point are treated special*
  * @param data to be processed,
  * @param listOfMeasures - list of measure steps in method
  * @param includeFirstMeasure boolean - specifies if first data point of each step should be included or not in the processing.
  *
  */
  getSumOfCurrentIntegratedPerStep(data: experimentDataObject,listOfMeasures: Array<techniqueParam>,includeFirstMeasure: boolean): resultObject{

    let timeDiff: number = 0;
    let currentIntegrated: number = 0;
    let current: number = 0;
    let sumOfCurrentIntegratedPerStep: number = 0;
    let sumOfCurrentPerStep: number = 0;

    let stepStartTime: string = '';
    let noOfMeasurementsPerStep: number = 0;
    let calcStepDuration =  0;//time taken for step to finish.
    let step: techniqueParam = null;
    let diffBetwTheoreticalAndExperimentalStepDuration = 0;//time difference between set step duration and time taken for step to finish.
    let lastPointCorrectionFactor = 0;
    let correctedSumOfCurrentIntegrated = 0;
    let correctedSumOfCurrentIntegratedArray = []; // Astep or value = Atot – (An. Txs/Tn)



    let resultObject = {
      noOfMeasurementsPerStepArray: [],
      currentIntegratedArray: [],
      sumOfCurrentArray: [],
      sumOfCurrentIntegratedArray: [], //sum of integrated current in each step.
      datetimeForCurrentArray: [],//the last data's datetime is stored for plotting result.
      timeDiffArray: [], // time between data collection
      experimentalStepDurationArray: [], //stores experimental step duration - Ttot
      diffBetwTheoreticalAndExperimentalStepDurationArray: [], //Txs=Ttot-Tstep
      lastPointCorrectionFactorArray: [], //Txs/Tn where Tn is last point of step.
      correctedSumOfCurrentIntegratedArray: [] // Astep or value = Atot – (An. Txs/Tn)
    }


    this.logError('        -----  ++++++++ ------- ','');
    this.logError(' Starting  Calculation of Integrated Current per step ','');
    this.logError('        -----  ++++++++ ------- ','');


    let length = data.dataArray.length;
    let counter = 1;
    let previousStepTimestamp = null;

    for(let i=0;i<length;i++){
      //First data point of step treated separately to use the stepStartTime instead of last measured data time.
      if(counter == 1){
        if(data.noOfMeasurementsPerStepArray[i] != undefined && data.noOfMeasurementsPerStepArray[i] != null){
          noOfMeasurementsPerStep = data.noOfMeasurementsPerStepArray[i];
          resultObject.noOfMeasurementsPerStepArray.push(noOfMeasurementsPerStep);
          this.logError('Printing no.of Steps: Iteration no. 1 ' + noOfMeasurementsPerStep,'');
        }
        else{
          this.logError('THIS SHOULD NOT HAPPEN','');
          this.logError('Could not determine noOfMeasurementsPerStep for next batch of step data','');
          throw Error('Could not determine noOfMeasurementsPerStep for next batch of step data');
        }

        if(data.stepStartTimeArray[i] != undefined && data.stepStartTimeArray[i] != null){
          stepStartTime = data.stepStartTimeArray[i];
        }
        else{
          this.logError('THIS SHOULD NOT HAPPEN ' + data.stepStartTimeArray[0],'');
          this.logError('Could not determine step start time for next batch of step data','');
          throw Error('Could not determine step start time for next batch of step data');
        }

        //previousStepTimestamp is stepStartTime
        previousStepTimestamp = stepStartTime;

        //
        // timeDiff = (new Date(data.chartDateArray[i]).getTime())  - (new Date(stepStartTime).getTime()) ;
        // calcStepDuration = timeDiff;
        //
        // currentIntegrated = (timeDiff)  * data.currentArray[i]/1000;
        //
        // //store for next iteration
        // previousMeasurementPointDuration = timeDiff;
        // previousCurrentIntegrated = currentIntegrated; //store for next iteration
        // previousStepId = data.stepIdArray[i];
        // previousStepTimestamp = data.chartDateArray[i];


      }

      //calculate current Integrated
      if(counter <= noOfMeasurementsPerStep){
        timeDiff = (new Date(data.chartDateArray[i]).getTime())  - (new Date(previousStepTimestamp).getTime()) ;
        calcStepDuration = calcStepDuration + timeDiff;
        current = data.currentArray[i];
        currentIntegrated = (timeDiff)  * current/1000;

        resultObject.timeDiffArray.push(timeDiff);

        resultObject.currentIntegratedArray.push(currentIntegrated);
      }

      //add to step current summation
      if(counter == 1 && includeFirstMeasure){
        this.logError('Iteration no. ' + (i+1) + ' Adding to sumOfCurrentIntegrated: ' + sumOfCurrentIntegratedPerStep + ' value: ' + currentIntegrated,'');
        sumOfCurrentPerStep = sumOfCurrentPerStep + current;
        sumOfCurrentIntegratedPerStep = sumOfCurrentIntegratedPerStep + currentIntegrated;
      }

      if(counter > 1){
        this.logError('Iteration no. ' + (i+1) + ' Adding to sumOfCurrentIntegrated: ' + sumOfCurrentIntegratedPerStep + ' value: ' + currentIntegrated,'');
        sumOfCurrentPerStep = sumOfCurrentPerStep + current;
        sumOfCurrentIntegratedPerStep = sumOfCurrentIntegratedPerStep + currentIntegrated;
      }

      //If last data point in step, same summation after correcting for time difference in last point..
      if(counter == noOfMeasurementsPerStep){

        resultObject.datetimeForCurrentArray.push(data.chartDateArray[i]);
        //create Ttot,Atot,Astep
        this.logError('Iteration no. ' + (i+1) + ' Save summed up current for step. ' + sumOfCurrentIntegratedPerStep,'');
        resultObject.sumOfCurrentIntegratedArray.push({stepId: data.stepIdArray[i], value: sumOfCurrentIntegratedPerStep});
        resultObject.sumOfCurrentArray.push({stepId: data.stepIdArray[i], value: sumOfCurrentPerStep});

        resultObject.experimentalStepDurationArray.push(calcStepDuration); //Ttot
        //load step parameters for getting duration.
        step = this.getStepByDatabaseRowIdFromMethod(listOfMeasures,data.stepIdArray[i]);
        if(step == null || step == undefined){
          this.logError('THIS SHOULD NOT HAPPEN','');
          this.logError('Could not determine step to get step parameters','');
          throw Error('Could not determine step to get step parameters');
        }
        //Txs
        diffBetwTheoreticalAndExperimentalStepDuration = calcStepDuration - (step.duration * 1000);
        resultObject.diffBetwTheoreticalAndExperimentalStepDurationArray.push(diffBetwTheoreticalAndExperimentalStepDuration);
        //Correction Factor
        lastPointCorrectionFactor = diffBetwTheoreticalAndExperimentalStepDuration/timeDiff;
        resultObject.lastPointCorrectionFactorArray.push(lastPointCorrectionFactor);

        //Astep - Correct for time difference in the last data point of the step.
        correctedSumOfCurrentIntegrated = sumOfCurrentIntegratedPerStep - (currentIntegrated * lastPointCorrectionFactor);
        this.logError('currentIntegrated: ' + currentIntegrated + ' lastPointCorrectionFactor: ' + lastPointCorrectionFactor,'');
        //this.SharedService.commsErrorArray.push(correctedSumOfCurrentIntegrated + '= currentIntegrated: ' + currentIntegrated + ' * lastPointCorrectionFactor: ' + lastPointCorrectionFactor + '\r\n');
        resultObject.correctedSumOfCurrentIntegratedArray.push({stepId: data.stepIdArray[i], value: correctedSumOfCurrentIntegrated});


        sumOfCurrentIntegratedPerStep = 0;
        sumOfCurrentPerStep = 0;
        calcStepDuration = 0;

        counter = 1;

      }
      else{
        //store for next iteration
        previousStepTimestamp = data.chartDateArray[i];
        counter++;
      }

    }

    this.logError('No.of entries in correctedSumOfCurrentIntegratedArray: ' + correctedSumOfCurrentIntegratedArray.length,'');

    return resultObject;
    //return correctedSumOfCurrentIntegratedArray;
  }

  /**
  * Calculates integrated current for each step. Integrated current is product of current and elapsed time between two measurements.
  * @param data to be processed,
  * @param currentArray - current data points
  * @param includeFirstMeasure boolean - specifies if first data point of each step should be included or not in the processing.
  * NOT USED
  */
  // getSumOfCurrentIntegratedPerStep(data: experimentDataObject,currentArray,includeFirstMeasure: boolean): Array<{stepId:number;value: number}>{
  //
  //   let currentIntegrated: number = 0;
  //   let sumOfCurrentIntegratedPerStep: number = 0;
  //   let timeDiff: number = 0;
  //   let stepStartTime: string = '';
  //   let noOfMeasurementsPerStep: number = 0;
  //
  //   let sumOfCurrentIntegratedArray: Array<{stepId:number;value: number}> = []; //sum of integrated current in each step.
  //
  //   //First entry treated separately to use the stepStartTime
  //
  //   let previousStepId: number = data.stepIdArray[0];
  //   let previousStepTimestamp = data.chartDateArray[0];
  //   if(data.noOfMeasurementsPerStepArray[0] != undefined && data.noOfMeasurementsPerStepArray[0] != null){
  //     noOfMeasurementsPerStep = data.noOfMeasurementsPerStepArray[0];
  //     this.logError('Iteration no. 1 ' + noOfMeasurementsPerStep,'');
  //   }
  //   else{
  //     this.logError('THIS SHOULD NOT HAPPEN','');
  //     this.logError('Could not determine noOfMeasurementsPerStep for next batch of step data','');
  //     throw Error('Could not determine noOfMeasurementsPerStep for next batch of step data');
  //   }
  //
  //   if(data.stepStartTimeArray[0] != undefined && data.stepStartTimeArray[0] != null){
  //     stepStartTime = data.stepStartTimeArray[0];
  //   }
  //   else{
  //     this.logError('THIS SHOULD NOT HAPPEN ' + data.stepStartTimeArray[0],'');
  //     this.logError('Could not determine step start time for next batch of step data','');
  //     throw Error('Could not determine step start time for next batch of step data');
  //
  //   }
  //
  //   timeDiff = (new Date(data.chartDateArray[0]).getTime())  - (new Date(stepStartTime).getTime()) ;
  //   currentIntegrated = (timeDiff)  * currentArray[0]/1000;
  //
  //
  //   if(includeFirstMeasure){
  //     this.logError('Iteration no. 1' + ' Adding to sumOfCurrentIntegrated: ' + sumOfCurrentIntegratedPerStep + ' value: ' + currentIntegrated,'');
  //     sumOfCurrentIntegratedPerStep =  currentIntegrated;
  //   }
  //
  //   let counter = 1;
  //   previousStepTimestamp = data.chartDateArray[0];
  //
  //   for(let i=1;i<data.dataArray.length;i++){
  //     if(counter < noOfMeasurementsPerStep){
  //       //this.logError('Iteration no. ' + (i+1) + ' Printing no of data per step: ' + data.noOfMeasurementsPerStepArray[i] + ' stepId: ' + data.stepIdArray[i] ,'');
  //       //this.logError('timeDiff. ' + data.chartDateArray[i] + ' - ' + previousStepTimestamp,'');
  //       timeDiff = (new Date(data.chartDateArray[i]).getTime())  - (new Date(previousStepTimestamp).getTime()) ;
  //
  //       //currentIntegrated = (timeDiff) * 24 * 3600 * currentArray[i];
  //       currentIntegrated = (timeDiff)  * currentArray[i]/1000;
  //       //this.logError('timediff: ' + timeDiff + ' current: ' + currentArray[i] + ' integrated: ' + currentIntegrated,'');
  //
  //       this.logError('Iteration no. ' + (i+1) + ' Adding to sumOfCurrentIntegrated: ' + sumOfCurrentIntegratedPerStep + ' value: ' + currentIntegrated,'');
  //
  //       sumOfCurrentIntegratedPerStep = sumOfCurrentIntegratedPerStep + currentIntegrated;
  //       //store this iteration stepId for the next iteration.
  //       previousStepId = data.stepIdArray[i];
  //       previousStepTimestamp = data.chartDateArray[i];
  //       counter++;
  //     }
  //     else{
  //       //this.logError(noOfMeasurementsPerStep,'');
  //       this.logError('Iteration no. ' + (i+1) + ' Adding to array the sumTotal   ' + sumOfCurrentIntegratedPerStep,'');
  //       sumOfCurrentIntegratedArray.push({stepId: previousStepId, value: sumOfCurrentIntegratedPerStep});
  //
  //
  //       if(data.noOfMeasurementsPerStepArray[i] != undefined || data.noOfMeasurementsPerStepArray[i] != null){
  //         noOfMeasurementsPerStep = data.noOfMeasurementsPerStepArray[i];
  //         this.logError('next step noOfMeasurementsPerStep obtained: ' + noOfMeasurementsPerStep,'');
  //       }
  //       else{
  //         this.logError('THIS SHOULD NOT HAPPEN','');
  //         throw Error('Could not determing noOfMeasurementsPerStep for next batch of step data');
  //       }
  //
  //       if(data.stepStartTimeArray[0] != undefined && data.stepStartTimeArray[0] != null){
  //         previousStepTimestamp = data.stepStartTimeArray[i];
  //         this.logError('previous step timeStamp: ' + previousStepTimestamp,'');
  //       }
  //       else{
  //         this.logError('THIS SHOULD NOT HAPPEN','');
  //         throw Error('Could not determine step start time for next batch of step data');
  //       }
  //       //this.logError('timeDiff. ' + data.chartDateArray[i] + ' - ' + previousStepTimestamp,'');
  //       timeDiff = (new Date(data.chartDateArray[i]).getTime())  - (new Date(previousStepTimestamp).getTime()) ;
  //       currentIntegrated = (timeDiff)  * currentArray[i]/1000;
  //
  //       if(includeFirstMeasure){
  //         sumOfCurrentIntegratedPerStep = currentIntegrated;
  //       }
  //       else{
  //         sumOfCurrentIntegratedPerStep = 0;
  //       }
  //       counter = 1;
  //       //store this iteration stepId for the next iteration.
  //       previousStepId = data.stepIdArray[i];
  //       previousStepTimestamp = data.chartDateArray[i];
  //     }
  //
  //   }
  //   // Add the last iteration sum to the arrays.
  //   this.logError(' Adding to array the sumTotal   ' + sumOfCurrentIntegratedPerStep,'');
  //   sumOfCurrentIntegratedArray.push({stepId: previousStepId, value: sumOfCurrentIntegratedPerStep});
  //
  //   return sumOfCurrentIntegratedArray;
  // }

  /**
  * Calculates integrated current for each step. Integrated current is product of current and elapsed time between two measurements.
  * @param data to be processed,
  * @param currentArray - current data points
  * @param includeFirstMeasure boolean - specifies if first data point of each step should be included or not in the processing.
  *
  */

  // /**
  // * Calculates Total current per step.
  // * Step 1: calculate integrated current for each data point.
  // *  Is product of current and elapsed time between two measurements.
  // * First data point and last data point are treated special*
  // * @param data to be processed,
  // * @param listOfMeasures - list of measure steps in method
  // * @param includeFirstMeasure boolean - specifies if first data point of each step should be included or not in the processing.
  // *
  // */
  // getSumOfCurrentIntegratedPerStep(data: experimentDataObject,listOfMeasures: Array<techniqueParam>,includeFirstMeasure: boolean): Array<{stepId:number;value: number}>{
  //
  //   let timeDiff: number = 0;
  //   let currentIntegrated: number = 0;
  //   let sumOfCurrentIntegratedPerStep: number = 0;
  //
  //   let stepStartTime: string = '';
  //   let noOfMeasurementsPerStep: number = 0;
  //   let stepDuration =  0;//step duration set in methods.
  //   let calcStepDuration =  0;//time taken for step to finish.
  //   let step: techniqueParam = null;
  //
  //   let sumOfCurrentIntegratedArray: Array<{stepId:number;value: number}> = []; //sum of integrated current in each step.
  //
  //   let previousMeasurementPointDuration = 0;
  //   let previousCurrentIntegrated = 0;
  //   let diffBetwTheoreticalAndExperimentalStepDuration = 0;//time difference between set step duration and time taken for step to finish.
  //   let lastPointCorrectionFactor = 0;
  //   let correctedSumOfCurrentIntegrated = 0;
  //
  //   let experimentalStepDurationArray = []; //stores experimental step duration - Ttot
  //   let diffBetwTheoreticalAndExperimentalStepDurationArray = []; //Txs=Ttot-Tstep
  //   let lastPointCorrectionFactorArray = []; //Txs/Tn where Tn is last point of step.
  //   let correctedSumOfCurrentIntegratedArray = []; // Astep or value = Atot – (An. Txs/Tn)
  //
  //   //First entry treated separately to use the stepStartTime instead of last measured data time.
  //
  //
  //   this.logError('        -----  ++++++++ ------- ','');
  //   this.logError(' Starting  Calculation of Integrated Current per step ','');
  //   this.logError('        -----  ++++++++ ------- ','');
  //
  //
  //   let previousStepId: number = data.stepIdArray[0];
  //   let previousStepTimestamp = data.chartDateArray[0];
  //
  //
  //   if(data.noOfMeasurementsPerStepArray[0] != undefined && data.noOfMeasurementsPerStepArray[0] != null){
  //     noOfMeasurementsPerStep = data.noOfMeasurementsPerStepArray[0];
  //     this.logError('Printing no.of Steps: Iteration no. 1 ' + noOfMeasurementsPerStep,'');
  //   }
  //   else{
  //     this.logError('THIS SHOULD NOT HAPPEN','');
  //     this.logError('Could not determine noOfMeasurementsPerStep for next batch of step data','');
  //     throw Error('Could not determine noOfMeasurementsPerStep for next batch of step data');
  //   }
  //
  //   if(data.stepStartTimeArray[0] != undefined && data.stepStartTimeArray[0] != null){
  //     stepStartTime = data.stepStartTimeArray[0];
  //   }
  //   else{
  //     this.logError('THIS SHOULD NOT HAPPEN ' + data.stepStartTimeArray[0],'');
  //     this.logError('Could not determine step start time for next batch of step data','');
  //     throw Error('Could not determine step start time for next batch of step data');
  //
  //   }
  //
  //   timeDiff = (new Date(data.chartDateArray[0]).getTime())  - (new Date(stepStartTime).getTime()) ;
  //   calcStepDuration = timeDiff;
  //   previousMeasurementPointDuration = timeDiff;
  //
  //   currentIntegrated = (timeDiff)  * data.currentArray[0]/1000;
  //   previousCurrentIntegrated = currentIntegrated;
  //
  //   if(includeFirstMeasure){
  //     this.logError('Iteration no. 1' + ' Adding to sumOfCurrentIntegrated: ' + sumOfCurrentIntegratedPerStep + ' value: ' + currentIntegrated,'');
  //     sumOfCurrentIntegratedPerStep =  currentIntegrated;
  //   }
  //
  //   let counter = 1;
  //   previousStepTimestamp = data.chartDateArray[0];
  //
  //   for(let i=1;i<data.dataArray.length;i++){
  //     if(counter < noOfMeasurementsPerStep){
  //       //this.logError('Iteration no. ' + (i+1) + ' Printing no of data per step: ' + data.noOfMeasurementsPerStepArray[i] + ' stepId: ' + data.stepIdArray[i] ,'');
  //       //this.logError('timeDiff. ' + data.chartDateArray[i] + ' - ' + previousStepTimestamp,'');
  //       timeDiff = (new Date(data.chartDateArray[i]).getTime())  - (new Date(previousStepTimestamp).getTime()) ;
  //
  //       //currentIntegrated = (timeDiff) * 24 * 3600 * currentArray[i];
  //       currentIntegrated = (timeDiff)  * data.currentArray[i]/1000;
  //       //this.logError('timediff: ' + timeDiff + ' current: ' + currentArray[i] + ' integrated: ' + currentIntegrated,'');
  //       calcStepDuration = calcStepDuration + timeDiff;
  //       previousMeasurementPointDuration = timeDiff;
  //
  //       this.logError('Iteration no. ' + (i+1) + ' Adding to sumOfCurrentIntegrated: ' + sumOfCurrentIntegratedPerStep + ' value: ' + currentIntegrated,'');
  //
  //       sumOfCurrentIntegratedPerStep = sumOfCurrentIntegratedPerStep + currentIntegrated;
  //       previousCurrentIntegrated = currentIntegrated;
  //       //store this iteration stepId for the next iteration.
  //       previousStepId = data.stepIdArray[i];
  //       previousStepTimestamp = data.chartDateArray[i];
  //       counter++;
  //     }
  //     else{
  //       //create Ttot,Atot,Astep
  //       this.logError('Iteration no. ' + (i+1) + ' Adding to array the sumTotal   ' + sumOfCurrentIntegratedPerStep,'');
  //       sumOfCurrentIntegratedArray.push({stepId: previousStepId, value: sumOfCurrentIntegratedPerStep});
  //
  //       experimentalStepDurationArray.push(calcStepDuration); //Ttot
  //       //load step parameters for getting duration.
  //       step = this.getStepByDatabaseRowIdFromMethod(listOfMeasures,previousStepId);
  //       //Txs
  //       diffBetwTheoreticalAndExperimentalStepDuration = calcStepDuration - (step.duration * 1000);
  //       diffBetwTheoreticalAndExperimentalStepDurationArray.push(diffBetwTheoreticalAndExperimentalStepDuration);
  //       //Correction Factor
  //       lastPointCorrectionFactor = diffBetwTheoreticalAndExperimentalStepDuration/previousMeasurementPointDuration;
  //       lastPointCorrectionFactorArray.push(lastPointCorrectionFactor);
  //
  //       //Astep
  //       correctedSumOfCurrentIntegrated = sumOfCurrentIntegratedPerStep - (previousCurrentIntegrated * lastPointCorrectionFactor);
  //       this.logError('previousCurrentIntegrated: ' + previousCurrentIntegrated + ' lastPointCorrectionFactor: ' + lastPointCorrectionFactor,'');
  //       this.SharedService.commsErrorArray.push(correctedSumOfCurrentIntegrated + '= previousCurrentIntegrated: ' + previousCurrentIntegrated + ' * lastPointCorrectionFactor: ' + lastPointCorrectionFactor + '\r\n');
  //       correctedSumOfCurrentIntegratedArray.push({stepId: previousStepId, value: correctedSumOfCurrentIntegrated});
  //
  //
  //       if(data.noOfMeasurementsPerStepArray[i] != undefined || data.noOfMeasurementsPerStepArray[i] != null){
  //         noOfMeasurementsPerStep = data.noOfMeasurementsPerStepArray[i];
  //         this.logError('next step noOfMeasurementsPerStep obtained: ' + noOfMeasurementsPerStep,'');
  //       }
  //       else{
  //         this.logError('THIS SHOULD NOT HAPPEN','');
  //         throw Error('Could not determing noOfMeasurementsPerStep for next batch of step data');
  //       }
  //
  //       if(data.stepStartTimeArray[0] != undefined && data.stepStartTimeArray[0] != null){
  //         previousStepTimestamp = data.stepStartTimeArray[i];
  //         this.logError('previous step timeStamp: ' + previousStepTimestamp,'');
  //       }
  //       else{
  //         this.logError('THIS SHOULD NOT HAPPEN','');
  //         throw Error('Could not determine step start time for next batch of step data');
  //       }
  //       //this.logError('timeDiff. ' + data.chartDateArray[i] + ' - ' + previousStepTimestamp,'');
  //       timeDiff = (new Date(data.chartDateArray[i]).getTime())  - (new Date(previousStepTimestamp).getTime()) ;
  //       currentIntegrated = (timeDiff)  * data.currentArray[i]/1000;
  //
  //       if(includeFirstMeasure){
  //         sumOfCurrentIntegratedPerStep = currentIntegrated;
  //         calcStepDuration = timeDiff;
  //       }
  //       else{
  //         sumOfCurrentIntegratedPerStep = 0;
  //         calcStepDuration = 0;
  //       }
  //       counter = 1;
  //       //store this iteration stepId for the next iteration.
  //       previousStepId = data.stepIdArray[i];
  //       previousStepTimestamp = data.chartDateArray[i];
  //     }
  //
  //   }
  //   // Add the last iteration sum to the arrays.
  //   this.logError(' Last step - Adding to array the sumTotal   ' + sumOfCurrentIntegratedPerStep,'');
  //   sumOfCurrentIntegratedArray.push({stepId: previousStepId, value: sumOfCurrentIntegratedPerStep});
  //   experimentalStepDurationArray.push(calcStepDuration);
  //   step = this.getStepByDatabaseRowIdFromMethod(listOfMeasures,previousStepId);
  //   //Txs
  //   diffBetwTheoreticalAndExperimentalStepDuration = calcStepDuration - (step.duration*1000);
  //   diffBetwTheoreticalAndExperimentalStepDurationArray.push(diffBetwTheoreticalAndExperimentalStepDuration);
  //   //Correction Factor‚
  //   lastPointCorrectionFactor = diffBetwTheoreticalAndExperimentalStepDuration/previousMeasurementPointDuration;
  //   lastPointCorrectionFactorArray.push(lastPointCorrectionFactor);
  //
  //   //Astep
  //   correctedSumOfCurrentIntegrated = sumOfCurrentIntegratedPerStep - (previousCurrentIntegrated * lastPointCorrectionFactor);
  //   correctedSumOfCurrentIntegratedArray.push({stepId: previousStepId, value: correctedSumOfCurrentIntegrated});
  //   this.logError('previousCurrentIntegrated: ' + previousCurrentIntegrated + ' lastPointCorrectionFactor: ' + lastPointCorrectionFactor,'');
  //   this.SharedService.commsErrorArray.push(correctedSumOfCurrentIntegrated + '= previousCurrentIntegrated: ' + previousCurrentIntegrated + ' * lastPointCorrectionFactor: ' + lastPointCorrectionFactor + '\r\n');
  //   this.logError('No.of entries in correctedSumOfCurrentIntegratedArray: ' + correctedSumOfCurrentIntegratedArray.length,'');
  //
  //   //return sumOfCurrentIntegratedArray;
  //   return correctedSumOfCurrentIntegratedArray;
  // }

  /**
  * Get measured data and process to create experimentDataObject for processing.
  * @param arrayOfStepData - stepData {
    startTime: Date;
    data: measurement[];
    zeroOffset: number;
    scalingFactor: number;
    stepId: number;
    }
  */

  processMeasuredData(arrayOfStepData: stepData[]): experimentDataObject{
    try{
      let reading;
      let measurementRef;
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
            reading = String(this.SharedService.convertToInteger(measurementRef.dataBytesArray));
          }
          dataForProcessing.dataArray.push(reading);
          dataForProcessing.chartDateArray.push(date);
          dataForProcessing.stepIdArray.push(stepRef.stepId);
          dataForProcessing.noOfMeasurementsPerStepArray.push(length);
          dataForProcessing.stepStartTimeArray.push(stepRef.startTime.toISOString());
          dataForProcessing.currentArray.push(((reading as any) - (stepRef.zeroOffset as any) ) * (stepRef.scalingFactor as any)); //TODO make part of experimentDataObject
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


/**
* Processes data for every cycle measured in a method, and display
* @param arrayOfStepData - stepData {
  startTime: Date;
  data: measurement[];
  zeroOffset: number;
  scalingFactor: number;
  stepId: number;
  }
*
*/
  async showLive(arrayOfStepData: stepData[],postProcessingParamObj,listOfMeasures: Array<techniqueParam>): Promise<number>{
    try{
      let finalCharge: number = null;
      let dataForProcessing = this.processMeasuredData(arrayOfStepData);
      let resultObject = this.getSumOfCurrentIntegratedPerStep(dataForProcessing,listOfMeasures,postProcessingParamObj.includeFirstMeasure);
      let sumOfCurrentIntegratedArray = resultObject.correctedSumOfCurrentIntegratedArray;

      if(sumOfCurrentIntegratedArray == null || sumOfCurrentIntegratedArray == undefined){
        throw Error('Could not calculate integrated current for the steps');
      }
      if(sumOfCurrentIntegratedArray[0] == null || sumOfCurrentIntegratedArray[0] == undefined){
        throw Error('Could not calculate integrated current for the steps');
      }
      if(sumOfCurrentIntegratedArray[1] == null || sumOfCurrentIntegratedArray[1] == undefined){
        // no step 2 defined.
        finalCharge = sumOfCurrentIntegratedArray[0].value;
        this.logError('Step2 is null: So Finalcharge: ' + sumOfCurrentIntegratedArray[0].value ,'');
      }
      else{
        finalCharge = sumOfCurrentIntegratedArray[0].value - sumOfCurrentIntegratedArray[1].value;
      }

      let result = (finalCharge - postProcessingParamObj.offset) / postProcessingParamObj.sensitivity;
      this.logError('resulting concentration is : ' + result + ' ' + postProcessingParamObj.unitDependentOnSensitivity,'');
      return result;
    }
    catch(e){
      throw e;
    }
  }

  // calculateConcentration(data)

  /**
  *  To get the correct step from the experiment method
  *  Returns a reference to the step in the array.
  */
  getStepByDatabaseRowIdFromMethod(listOfMeasures: Array<techniqueParam>,value:number): techniqueParam {
    this.logError('length of listOfMeasures ' + listOfMeasures.length,'');
    for (let i=0, len=listOfMeasures.length; i<len; i++) {
      // if (method.listOfMeasures[i].databaseRowid == value) return method.listOfMeasures[i];
      // this.logError('printing measure stepNumber: ' + listOfMeasures[i].stepNumber + ' value ' + value,'');
      if (listOfMeasures[i].stepNumber == value) return listOfMeasures[i];
    }
  }

  logError(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    console.log('DataProcessingService: ' + message + ' ' + errStackTrace);
    this.SharedService.saveForLog((new Date().toISOString() + ': CalibratePage: ').concat(message).concat(errStackTrace));
  }
}
