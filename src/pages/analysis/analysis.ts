import { Component,ViewChild,ChangeDetectorRef } from '@angular/core';
import { Content, NavController,Platform,ToastController,LoadingController } from 'ionic-angular';
import { Chart } from 'chart.js';
import { HomePage} from '../home/home';
import { DatabaseProvider } from '../../providers/database/database';
import { SharedserviceProvider } from '../../providers/sharedservice/sharedservice';
import { File } from '@ionic-native/file';
import { BackgroundMode } from '@ionic-native/background-mode';
import { EmailProvider } from '../../providers/email/email';
import { HelpModalPage } from '../help-modal/help-modal';
import { CalibratePage } from '../calibrate/calibrate';
import { DataProcessingProvider} from '../../providers/dataprocessingservice/dataprocessingservice';




@Component({
  selector: 'page-analysis',
  templateUrl: 'analysis.html'
})
export class AnalysisPage {


//test
  items;
  savedParentNativeURLs = [];
//test over
  @ViewChild(Content) content: Content;
  //Canvas for viewing graph - one for sensor data and another for sensor temperature
  @ViewChild('lineCanvas') lineCanvas;
  @ViewChild('unitOfCharge') unitOfChargeViewChild; //to setFocus
  @ViewChild('offset') offsetViewChild;
  @ViewChild('sensitivity') sensitivityViewChild;
  @ViewChild('unitDependentOnSensitivity') unitDependentOnSensitivityViewChild;
  @ViewChild('algorithmView') algorithmViewChild;



  lineChart: Chart;
  userIsViewingChart: boolean = false;
  showNoDataView: boolean = false; // View flag - No chart displayed to user if no data found in db
  chartRendered: boolean = false;
  flagForDatabaseTransaction: boolean = false;
  deviceName: string; //name of current bluetooth device - populated from SharedService.
  userEmail: string; //required for sending email
  backgroundModeActivated:boolean = false;
  calcCharge; //ngModel for GUI - calculateCharge form select element.


  //holds data retrieved from local database (interface experimentDataObject in providers/database).
  dataForOneDay: experimentDataObject = {
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
  listOfExperiments:{name: string, experimentId: number, dateCreated: string, postProcessingParamsId: number}[];
  chosenExperiment = {
    name: null,
    experimentId: null,
    dateCreated: null,
    count: null,
    postProcessingParamsId: null,
    method: null
  };
  experimentId: number = null;


  currentIArray: Array<number> = []; //Stores current = (bits-zeroOffset) * scaling factor.
  timeDiffArray: Array<number> = []; // time between data collection

  currentIntegratedArray: Array<number> = []; //Stores chargePerStep (current * time interval betw two readings)
  sumOfCurrentArray: Array<number> = []; // sum of current in each step
  sumOfCurrentIntegratedArray: Array<{stepId: number,value:number}> = []; //sum of integrated current in each step = Atot
  experimentalStepDurationArray: Array<number> = []; //stores experimental step duration
  diffBetwTheoreticalAndExperimentalStepDurationArray: Array<number> = []; //Txs=Ttot-Tstep
  lastPointCorrectionFactorArray: Array<number> = []; //Txs/Tn where Tn is last point of step.
  correctedSumOfCurrentIntegratedArray: Array<{stepId: number,value:number}> = []; // Astep or value = Atot – (An. Txs/Tn)
  finalChargeArray: Array<number>  = []; // step 1/ step 2/ step 1 - step 2 (deteremined by user. )
  resultArray: Array<number> = []; //(sumOfCurrentIntegrated - offset ) * sensitivity
  datetimeForCurrentArray: Array<string> = [];
  noOfMeasurementsPerStepArray: Array<number> = []; //number of measurements in each step.
  postProcessingParamObj: postProcessingParams = null;
  // Algorithm to be used if multiple steps measured.
  algorithmArray: Array<algorithm> = [];


  constructor(public platform: Platform,
    public navCtrl: NavController,
    public toast: ToastController,
    private loadingCtrl: LoadingController,
    public fileNavigator: File,
    private EmailProvider: EmailProvider,
    private backgroundMode: BackgroundMode,
    public DatabaseService: DatabaseProvider,
    public SharedService: SharedserviceProvider,
    public DataProcessingService: DataProcessingProvider,
    public cdr: ChangeDetectorRef
  ) {

    this.platform.ready().then(()=>{

      //subscribe to delete all data action in settings page.
      this.SharedService.renewIfDeletedAllData().subscribe((flag)=>{
        //delete all data in buffer and update chart.
        if(flag){
          this.logError('Subscription for data deletion called: ' + flag,'');
          //this.dataForOneDay = [];
          if(this.dataForOneDay != null && this.dataForOneDay != undefined){
            this.dataForOneDay.length = 0;
            this.dataForOneDay.dataArray = [];
            this.dataForOneDay.chartDateArray = [];
            this.dataForOneDay.stepIdArray = [];
            this.dataForOneDay.temperatureArray = [];
            this.dataForOneDay.noOfMeasurementsPerStepArray = [];
            this.dataForOneDay.stepStartTimeArray = [];
            this.dataForOneDay.experimentId = null;
            this.dataForOneDay.method = null;
            this.latestDataDate();
          }
        }

      });


      this.initializePostProcessingParams();


    }); //End of platform ready call function


    this.backgroundMode.on('deactivate').subscribe(()=>{
      this.backgroundModeActivated = false;
      this.logError( 'BGM deactivated ', '');

    },(error)=>{
      this.logError(' BGM deactivate handler threw an error ',error);
    });

    this.backgroundMode.on("activate").subscribe(()=>{
      this.logError(' BGM activated at ', new Date().toISOString());
      this.backgroundModeActivated = true;
    },(error)=>{
      this.logError('BGM activate handler threw an error ',error);
    });
  }//End of constructor

  // set boolean that user is viewing charts.

  ionViewDidEnter () {
    this.userIsViewingChart = true;
    this.logError('userIsViewingChart set in ionViewDidEnter enter ' + true,'');
  }

  //Check authentication and renew averageOver.

  ionViewWillEnter(){
    this.SharedService.getAuth().then((val) => {
      if(!val){
        this.SharedService.showToast('You have to be logged in to access this view');
        this.navCtrl.setRoot(HomePage);
        return;
      }
      else{
        this.userEmail = this.SharedService.getUserEmail();
        this.userIsViewingChart = true;
        this.listOfExperiments = [];
        this.getListOfExperiments(); //async - loads list of experiments that are available for user+device.
        if(!this.chartRendered){
          this.showNoDataView = false;
          this.logError('ionViewWillEnter triggers latestData','');

          this.latestDataDate(); //was in ionViewDidEnter - but linecanvas was undefined sometimes when ionViewDidEnter is called and resulted in error..
        }else{
          this.logError('chartRendered is true, old Analysis page view is maintained. ','');
        }
        if(this.SharedService.device != null) {
          this.deviceName = this.SharedService.device.name;
          this.logError('Do nothing so that old chart page view is maintained. ','');
        }
        else{
          if(!this.showNoDataView){
            this.SharedService.showToast('No linked device could be discovered on the app');
          }
        }
      }
    })
    .catch(err=>{
      this.logError('Error getting authentication details from SharedService',err);
      this.fatalErrorNeedsAttention('An error occured when retrieving authentication parameters from localStorage',err);
    });
  }

  /**
  * Set default values for the global object postProcessingParamObj properties
  */

  initializePostProcessingParams(){
    this.postProcessingParamObj = {
                              databaseRowid: null,
                              unitOfCharge: 'mC',
                              offset: 0,
                              sensitivity: 1,
                              unitDependentOnSensitivity:' g/L',
                              algorithm: null,
                              includeFirstMeasure: false
                            };
  }

  /**
  * Get a list of user specific experiments.
  * Requires user id
  */


  async getListOfExperiments(){


    try{
      this.listOfExperiments = await this.DatabaseService.getListOfExperiments(this.SharedService.userId);
      this.cdr.detectChanges();
    }
    catch(err){
      this.fatalErrorNeedsAttention('Error creating an experiment list for viewing',err);
    }
  }


  /**
  * Global parameter chosenExperiment points to the selected experiment.
  * Trigger call for data from database.
  */


  loadChosenExperiment(event){
    this.logError('Event fired for loading experiment ' + event + JSON.stringify(event),'');
    // this.logError('chosenExperiment before ' + JSON.stringify(this.chosenExperiment),'');
    this.chosenExperiment = event;
    // this.logError('chosenExperiment after ' + JSON.stringify(this.chosenExperiment),'');
    this.experimentId = this.chosenExperiment.experimentId;

    this.latestDataDate(); //will use the rowid stored in chosenExperiment object to get experiment data.
  }


  /**
   * Is called every time user views Analysis page - via ionViewWillEnter()
   * sets global parameter experimentId with id of the last stored dataset
   * and makes a Database call to update Graph with that data.
  */
  async latestDataDate() {

    if(this.chosenExperiment.method != null){
      this.retrieveAndLoadExperiment();
    }
    else{
      try{
        //Returns object {experimentId: number, name: string, count: number, method: methodParam,dateCreated: string};
        let experimentDetails = await  this.DatabaseService.getExperimentDetails(this.experimentId) //(experimentid can be null. )
        if(experimentDetails.experimentId == null){
          this.logError('No data found on this device ','');
          this.showNoDataView = true;
        }
        else{
          //There is some data.
          this.logError('Got experimentDetails: ' + JSON.stringify(experimentDetails),'');
          this.chosenExperiment.name = experimentDetails.name;
          this.chosenExperiment.dateCreated = experimentDetails.dateCreated;
          this.chosenExperiment.experimentId = experimentDetails.experimentId;
          this.chosenExperiment.count = experimentDetails.count;
          this.chosenExperiment.method = experimentDetails.method;
          this.chosenExperiment.postProcessingParamsId = experimentDetails.postProcessingParamsId;
          this.postProcessingParamObj = await this.DatabaseService.getPostProcessingParam(experimentDetails.postProcessingParamsId);
          this.calcCharge = this.postProcessingParamObj.algorithm.index;
          this.logError('postProcessingParams: ' + JSON.stringify(this.postProcessingParamObj),'');
          this.algorithmArray = this.SharedService.createStepCalculationOptions(this.chosenExperiment.method);

          this.showNoDataView = false;
          this.experimentId = experimentDetails.experimentId;

          this.retrieveAndLoadExperiment();
        }
      }
      catch(error){
      this.logError('Error in latestDataDate: ' + JSON.stringify(error, null, 4),error);
      this.SharedService.presentAlert('','An error occured while fetching the last stored dataset from storage','Dismiss');
      return;
      }
    }
  }

  //Retrieves data from local database storage for the requested day (available in chartDate) and displays on chart.

  retrieveAndLoadExperiment(){
    //Check if a data refresh call is in progress
    if(this.flagForDatabaseTransaction){
      this.logError('Transaction in progress','return');
      return;
    }



    let newLoading; //loading controller.

    this.flagForDatabaseTransaction = true;
    let graphTitle = 'Experiment: ' + this.chosenExperiment.name;
    let count = this.chosenExperiment.count;
    let startIndex = 0;
    let pageSize = 50000;
    let totalCount = count;
    let noOfPages = Math.round(totalCount/pageSize);
    //empty global arrays holding old data.

    this.dataForOneDay.dataArray = [];
    this.dataForOneDay.chartDateArray = [];
    this.dataForOneDay.stepIdArray = [];
    this.dataForOneDay.temperatureArray = [];
    this.dataForOneDay.noOfMeasurementsPerStepArray = [];
    this.dataForOneDay.stepStartTimeArray = [];
    this.dataForOneDay.length = 0;
    this.dataForOneDay.method = this.chosenExperiment.method;
    this.dataForOneDay.experimentId = this.chosenExperiment.experimentId;
    this.currentIArray = [];
    this.timeDiffArray = []; // time between data collection
    this.currentIntegratedArray = []; //Stores chargePerStep (current * time interval betw two readings)
    this.sumOfCurrentArray = []; // sum of current in each step
    this.sumOfCurrentIntegratedArray = []; //sum of integrated current in each step.
    this.finalChargeArray = []; // step 1/ step 2/ step 1 - step 2 (deteremined by user. )
    this.resultArray = []; //(sumOfCurrentIntegrated - offset ) * sensitivity
    this.datetimeForCurrentArray = [];

    this.experimentalStepDurationArray = []; //stores experimental step duration
    this.diffBetwTheoreticalAndExperimentalStepDurationArray = []; //Txs=Ttot-Tstep
    this.lastPointCorrectionFactorArray = []; //Txs/Tn where Tn is last point of step.
    this.correctedSumOfCurrentIntegratedArray = []; // Astep or value = Atot – (An. Txs/Tn)

    this.logError('chosenExperiment: ' + JSON.stringify(this.chosenExperiment),'');
    if(count == 0){
      this.logError('No data to view for: ' + JSON.stringify(this.chosenExperiment.experimentId),'');
      this.flagForDatabaseTransaction = false;
      this.displayChart(graphTitle,
                        this.dataForOneDay.chartDateArray,
                        this.dataForOneDay.currentArray,
                        'Time','Current');
      this.SharedService.showToast('No data has been recorded for this experiment');
    }
    else{
      newLoading = this.loadingCtrl.create({
        content: 'Refreshing chart..'
      });
      return newLoading.present()
      .then(()=>{
        return this.getExperimentData(startIndex,pageSize,totalCount,noOfPages,0,this.chosenExperiment.experimentId,this.chosenExperiment.method)
      })
      .then(()=>{
        this.flagForDatabaseTransaction = false;
        if(this.dataForOneDay.length > 3000){
          let downSizeFactor = Math.round(this.dataForOneDay.length / 1000);
          this.logError('When data is > 3000 cul data by a factor of ' + downSizeFactor,'');

          //show culled dataset - averaging used for now.
          this.logError('Before averaging time ' + new Date(),'');
          let culledData = this.getAveragedDataSet(downSizeFactor,this.dataForOneDay.length,this.dataForOneDay.currentArray,this.dataForOneDay.chartDateArray);
          this.logError('After averaging time ' + new Date(),'');
          this.displayChart(graphTitle,culledData.newAxisArray,culledData.newDataArray,'Time','Current in '+ this.dataForOneDay.method.unitOfCurrent);
        }
        else{
          this.displayChart(graphTitle,this.dataForOneDay.chartDateArray,this.dataForOneDay.currentArray,'Time','Current in '+ this.dataForOneDay.method.unitOfCurrent);
        }
        newLoading.dismiss();
        newLoading = null;
      })
      .catch((error)=>{
        if(newLoading!=null) newLoading.dismiss();
        this.logError('Could not finish database request ',error);
        this.flagForDatabaseTransaction = false;
        this.SharedService.presentAlert('Fatal error','Data from local storage could not be retrieved', 'DISMISS');
      });
    }
  }

  /**
    Gets the data from localStorage oh phone in batches and stores them in global object dataForOneDay
  * @param startIndex
    @param pageSize
    @param totalCount
    @param noOfPages
    @param offset
    @param startDate: Date - starting time of measurement
    @param endDate: Date  - ending time of measurement
  */

  getExperimentData(startIndex,pageSize,totalCount,noOfPages,offset,experimentId,method){
    return this.DatabaseService.getExperimentData(experimentId,pageSize,offset)
    .then(dataForOneDay => { //chartData interface
      this.dataForOneDay.dataArray = this.dataForOneDay.dataArray.concat(dataForOneDay.dataArray);
      this.dataForOneDay.chartDateArray = this.dataForOneDay.chartDateArray.concat(dataForOneDay.chartDateArray);
      this.dataForOneDay.stepIdArray = this.dataForOneDay.stepIdArray.concat(dataForOneDay.stepIdArray);
      this.dataForOneDay.temperatureArray = this.dataForOneDay.temperatureArray.concat(dataForOneDay.temperatureArray);
      this.dataForOneDay.noOfMeasurementsPerStepArray = this.dataForOneDay.noOfMeasurementsPerStepArray.concat(dataForOneDay.noOfMeasurementsPerStepArray);
      this.dataForOneDay.stepStartTimeArray = this.dataForOneDay.stepStartTimeArray.concat(dataForOneDay.stepStartTimeArray);
      this.dataForOneDay.currentArray = this.dataForOneDay.currentArray.concat(dataForOneDay.currentArray);
      this.dataForOneDay.length = this.dataForOneDay.length + dataForOneDay.length;
      startIndex = startIndex + 1;
      if(noOfPages>0 && startIndex <= noOfPages){
        offset = offset + pageSize;
        return this.getExperimentData(startIndex,pageSize,totalCount,noOfPages,offset,experimentId,method);
      }
      else{
        return;
      }
    },(error)=>{
      this.logError('The data could not be retrieved ',error);
      this.SharedService.presentAlert('Fatal error','Data could not be retrieved for viewing from local storage','DISMISS');
      this.flagForDatabaseTransaction = false;
      return;
    });
  }


  /**
  * returns data points that is a simple averaged dataset
  * of subsets from the series.
  * @param averageOver - subset size
  * @param dataLength - no. of numbers in series
  * @param dataArray  - original series in array format.
  * @param xAxisArray
  * @param commandArray
  * @param rLoadAndIntZArray
  * @param samplingSetupArray
  * @returns object chartData { newDataArray: newDataArray,
                  newAxisArray:newAxisArray,
                  newCommandArray:newCommandArray,
                  newrLoadAndIntZArray: newrLoadAndIntZArray,
                  newSamplingSetupArray: newSamplingSetupArray};
  */

  getAveragedDataSet(averageOver,dataLength,dataArray,xAxisArray){
    let newDataArray = [];
    let newAxisArray = [];

    for (let i = 0; i < dataLength; i++) {
      i = i + (averageOver -1);
      //enter the last date in the window being averaged.
      newAxisArray.push(xAxisArray[i]);
      //subarray of previous data with lenght from averageOver
      let subArray = dataArray.slice((i-(averageOver-1)),i);
      newDataArray.push(this.arrayAverage(subArray));
      if((dataLength - i)<= averageOver){
        //discard rest of data for now.
        break;
      }
    }
    this.logError('Printing avg array data length ' + newDataArray.length,'');
    return {newDataArray: newDataArray,newAxisArray:newAxisArray};
  }

  /**
  * returns an average of an array.
  * @param array Array whose average is returned.
  * @return average as number
  */

  arrayAverage(array){
    var sum = 0;
    for( var i = 0; i < array.length; i++ ){
        sum += parseInt( array[i], 10 ); //don't forget to add the base
    }
    var avg = sum/array.length;
    return avg;
  }



  /**
  * Initializes lineChart with given data (graph title, xaxis label, yaxis array)
  * if not using graphTitle - enter empty string

  * @param graphTitle - string - usually says Day view and date.
  * @param xAxisDataArray - array - data for the xaxis.
  * @param graphDataArray - array carring data to be plotted.
  * @param xAxisLabel - string with label for xaxis.. time etc.
  * @param yAxisLabel - string with label for yaxis - response bits, charge etc.
  */

  displayChart(graphTitle,xAxisDataArray,graphDataArray,xAxisLabel, yAxisLabel) {

    //update old chart with new data
    //check if undefined - the first linechart render may not have been called yet
    if(this.lineChart != undefined && this.lineChart !=null){
      this.logError('Linechart available, update with new data','');
      this.lineChart.data.datasets[0].label = graphTitle;
      this.lineChart.data.labels = xAxisDataArray;
      this.lineChart.data.datasets[0].data = graphDataArray;
      this.lineChart.options.title.text = graphTitle;
      this.lineChart.options.scales.xAxes[0].scaleLabel.labelString = xAxisLabel;
      this.lineChart.options.scales.yAxes[0].scaleLabel.labelString = yAxisLabel;
      this.lineChart.update();
      this.content.scrollToTop();
      return;
    }

    let i=0;
    while(this.lineCanvas == undefined){
      setTimeout(i++,1000);
      if(i==2) {
        alert('Canvas not ready for display');
        break;
      }
    }

    this.lineChart = new Chart(this.lineCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: xAxisDataArray,
        datasets: [{
          label: graphTitle,
          fill: false,
          lineTension: 0.1,
          backgroundColor: "rgba(75,192,192,0.4)",
          borderColor: "rgba(75,192,192,1)",
          borderCapStyle: 'butt',
          borderDash: [],
          borderDashOffset: 0.0,
          borderJoinStyle: 'miter',
          pointBorderColor: "rgba(75,192,192,1)",
          pointBackgroundColor: "#fff",
          pointBorderWidth: 1,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: "rgba(75,192,192,1)",
          pointHoverBorderColor: "rgba(220,220,220,1)",
          pointHoverBorderWidth: 2,
          pointRadius: 1,
          pointHitRadius: 10,
          data: graphDataArray,
          spanGaps: false,
        }]
      },
      options: {
        tooltips: {
          enabled: false
        },
        animation: false,
        title: {
          display: true,
          text: graphTitle,
          fontStyle: 'normal'
        },
        legend: {
          display: false,
          position: 'bottom',
          boxWidth: 2,
        },

        scales: {
          xAxes: [{
            type: 'time',
            time: {
              displayFormats: {
                'millisecond': 'h:mm:ss a',
                'second': 'h:mm:ss a',
                'minute': 'h:mm:ss a',
                'hour': 'h:mm:ss a',
                'day': 'h:mm:ss a',
                'week': 'h:mm:ss a',
                'month': 'h:mm:ss a',
                'quarter': 'h:mm:ss a',
                'year': 'h:mm:ss a',
              }
            },
            scaleLabel: {
              display: true,
              labelString: xAxisLabel,
            }
          }],
          yAxes:[{
            scaleLabel: {
              display: true,
              labelString: yAxisLabel,
            }
          }]
        }
      }

    },(error)=>{
      this.logError('AnalysisPage:  Error while rendering chart ',error);
      this.chartRendered = false;

    });

    this.logError('Time after chart was rendered ' + new Date(),'');

    this.chartRendered = true;
  }


  /**
  * Download Raw data as a csv file
  */

  downloadCSV() {
    if(this.experimentId == null){
      this.SharedService.presentAlert('Fatal Error','Experiment could not be determined for downloading','Dismiss');
      return;
    }
    if(this.sumOfCurrentArray.length == 0){
      this.SharedService.presentAlert('Info','Please make sure you have clicked on "Plot Result" button before trying to download the data','DISMISS');
      return; //Do not proceed further
    }


    // create filename for download

    let path = this.fileNavigator.externalDataDirectory; //'file:///';
    let today = new Date();
    let filename = this.convertDateForFileName(today);
    let dataRef = [];
    filename = filename + '_dataProc.csv';


    let preparing = this.loadingCtrl.create({
      content: 'Preparing file..'
    });
    return preparing.present()
    .then(()=>{

      //Start creating array of string with comma separated data.
      dataRef.push('Data from: ' + this.DatabaseService.convertDateToExcelFormat_NoTimezoneoffset(this.dataForOneDay.chartDateArray[0]) +' \r\n');
      dataRef.push('Total No. of data points: ' + this.dataForOneDay.length +' \r\n');
      dataRef.push('Experiment name: ' + this.chosenExperiment.name +' \r\n');
      dataRef.push('Method name: ' + this.dataForOneDay.method.name +' \r\n');
      let step;
      let saveData = '';
      for(let i=0; i<this.dataForOneDay.method.listOfPreconditions.length; i++){
        step = this.dataForOneDay.method.listOfPreconditions[i];
        dataRef.push('Precondition Step' + (i+1) + ':: \r');
        dataRef.push('Gain: ' + step.gain.description + ' Potential: ' + step.potential.description + ' Duration ' + step.duration+'s');
        if(step.save){
          dataRef.push('@ ' + step.dataFrequency+'ms');
          saveData = 'Data saved';
        }
        else{
          saveData = 'Data not saved';
        }
        dataRef.push(' ' + saveData);
        dataRef.push('\r\n');
      }
      for(let i=0; i<this.dataForOneDay.method.listOfMeasures.length; i++){
        step = this.dataForOneDay.method.listOfMeasures[i];
        dataRef.push('Measures Step ' + (i+1) + ':: \r');
        dataRef.push('Gain: ' + step.gain.description + ', Potential: ' + step.potential.description + ', Save data: ' + step.save + ', Duration ' + step.duration+'s');
        if(step.save){
          dataRef.push('@ ' + step.dataFrequency+'ms');
        }
        dataRef.push('\r\n');
      }
      dataRef.push(' \n\n');
      dataRef.push('S.No.,DateTime Excel Format, Raw sensor data, Zero-offset, Scaling factor,Current,Units,Time difference,Current Integrated,Temperature in C, Step start time,Gain and Potential,rLoad and Internal Zero,Sampling setup\r\n');

      this.logError('-----  ++++++++ ------- ','');
      this.logError('Start writing data in csv format ','');
      this.logError('-----  ++++++++ ------- ','');

      let temperature;
      let stepStartTime;
      //Start iterating through data Array
      for (let i = 0; i < this.dataForOneDay.length; i++) {
        step = this.getStepByDatabaseRowIdFromMethod(this.dataForOneDay.method,this.dataForOneDay.stepIdArray[i]);

        if(this.dataForOneDay.temperatureArray[i]!= null){
          temperature = this.dataForOneDay.temperatureArray[i];
        }
        else{
          temperature = '';
        }
        if(this.dataForOneDay.stepStartTimeArray[i] != null){

          stepStartTime = this.DatabaseService.convertDateToExcelFormat_NoTimezoneoffset(this.dataForOneDay.stepStartTimeArray[i])
        }
        else{
          stepStartTime = '';
        }


        dataRef.push(
            (i+1)
            + ',' +
            this.DatabaseService.convertDateToExcelFormat_NoTimezoneoffset(this.dataForOneDay.chartDateArray[i])
            + ',' +
            this.dataForOneDay.dataArray[i]
            + ',' +
            step.zeroOffset
            + ',' +
            step.scalingFactor
            + ',' +
            this.dataForOneDay.currentArray[i]
            + ',' +
            this.dataForOneDay.method.unitOfCurrent
            + ',' +
            this.timeDiffArray[i]
            + ',' +
            this.currentIntegratedArray[i]
            // + ',' +
            // this.dataForOneDay.stepsArray[i]
            + ',' +
            temperature
            + ',' +
            stepStartTime
            + ',' +
            step.gain.description + ' ' + step.potential.description
            + ',' +
            step.gain.rLoad.description + ' ' + step.potential.intZ.description
            + ',' +
            step.duration + 's @ ' + step.dataFrequency + 'ms'
            + '\r\n'
          );
      }

      //create a blob from the array of strings to write to file.
      let blob = new Blob(dataRef, { type: 'text/csv' });
      return this.fileNavigator.writeFile(path,filename,blob,{replace:true})

    })
    .then((succ)=>{
      preparing.dismiss();
      if(dataRef.length==0){
        this.toast.create({
          message: `No data available for chosen date`,
          duration: 5000,
          position: 'top'
        }).present();
        return;
      }
      else{
        this.logError('Downloaded file!','');
        //show toast
        this.toast.create({
          message: `File ready for transfering`,
          duration: 2000,
          position: 'top'
        }).present();
        let subject = 'Data from ' + this.deviceName;
        let body = 'Please find attached all stored sensor data from device ' + this.deviceName;
        this.EmailProvider.sendEmail(this.userEmail,path.concat(filename),subject,body);
      }
    })
    .catch((error)=>{
      this.logError('An error during file download occured ',error);
      preparing.dismiss();
      this.toast.create({
        message: `File could not created for download`,
        duration: 3000,
        position: 'top'
      }).present();
    });

  }
  /**
  * Download Analysis data as a csv file
  */

  downloadAnalysisCSV() {
    if(this.sumOfCurrentArray.length == 0){
      this.SharedService.presentAlert('Info','No analysis available for download. Please make sure you have clicked on Plot Result button before trying to download the analysed data','DISMISS');
      return; //Do not proceed further
    }

    let path = this.fileNavigator.externalDataDirectory; //'file:///';
    let today = new Date();
    let filename = this.convertDateForFileName(today);
    filename = filename + '_Analysis.csv';
    let dataRef = [];
    let finalCharge = '';
    let result = '';

    let newLoading = this.loadingCtrl.create({
      content: 'Preparing file..'
    });
    return newLoading.present()
    .then(()=>{
      dataRef.push('Data from: ' + this.DatabaseService.convertDateToExcelFormat_NoTimezoneoffset(this.dataForOneDay.chartDateArray[0]) +' \r\n');
      dataRef.push('Total No. of data points: ' + this.dataForOneDay.length +' \r\n');
      dataRef.push('Experiment name: ' + this.chosenExperiment.name +' \r\n');
      dataRef.push('Method name: ' + this.dataForOneDay.method.name +' \r\n');
      dataRef.push('Offset = ,'+this.postProcessingParamObj.offset+'\r\n');
      dataRef.push('Sensitivity = ,' + this.postProcessingParamObj.sensitivity + '\r\n');
      let step;
      let saveData = '';
      for(let i=0; i<this.dataForOneDay.method.listOfPreconditions.length; i++){
        step = this.dataForOneDay.method.listOfPreconditions[i];
        dataRef.push('Precondition Step' + (i+1) + ':: \r');
        dataRef.push('Gain: ' + step.gain.description + ' Potential: ' + step.potential.description + ' Save data: ' + step.save + ' Duration ' + step.duration+'s');
        if(step.save){
          dataRef.push('@ ' + step.dataFrequency + 'ms');
          saveData = 'Data saved';
        }
        else{
          saveData = 'Data not saved';
        }
        dataRef.push(' ' + saveData);
        dataRef.push('\r\n');
      }
      //temp solution for getting stepnumber
      let stepsObjectArray = []; //will hold {id: number, stepNumber: number}

      for(let i=0; i<this.dataForOneDay.method.listOfMeasures.length; i++){
        step = this.dataForOneDay.method.listOfMeasures[i];
        //stepsObjectArray.push({id: step.databaseRowid, stepNumber: (i+1)});
        stepsObjectArray.push({id: step.stepNumber, stepNumber: (i+1)});
        dataRef.push('Measures Step ' + (i+1) + ':: \r');
        dataRef.push('Gain: ' + step.gain.description + ' Potential: ' + step.potential.description + ' Save data: ' + step.save + ' Duration ' + step.duration+'s');
        if(step.save){
          dataRef.push('@ ' + step.dataFrequency + 'ms');
        }
        dataRef.push('\r\n');
      }
      dataRef.push('Calculation of Final Charge = , ' + this.postProcessingParamObj.algorithm.description + '\r\n\n\n');
      dataRef.push('DateTime Excel Format, Step Number,No. of Measures per step,Ttot,Txs,CorrectionFactor,Sum Current, Sum Integrated Current,Corrected Sum Int Current,'
      + 'Unit of Charge,Final Charge,Result in ' +
      this.postProcessingParamObj.unitDependentOnSensitivity + '\r\n');

      let stepNumber;
      for(let i=0;i<this.sumOfCurrentArray.length;i++){
        //this.logError('iteration ' + i + ' stepid: ' + this.sumOfCurrentIntegratedArray[i].stepId,'');
        stepNumber = this.getStepNumber(stepsObjectArray,this.sumOfCurrentIntegratedArray[i].stepId);
        if(this.finalChargeArray[i] == 0){
          finalCharge = '';
        }
        else{
          finalCharge = <string><any>this.finalChargeArray[i];
        }

        if(this.resultArray[i] == 0){
          result = '';
        }
        else{
          result = <string><any>this.resultArray[i];
        }

        dataRef.push(
          this.DatabaseService.convertDateToExcelFormat_NoTimezoneoffset(this.datetimeForCurrentArray[i])
          + ',' +
          stepNumber
          + ',' +
          this.noOfMeasurementsPerStepArray[i]
          + ',' +
          this.experimentalStepDurationArray[i]
          + ',' +
          this.diffBetwTheoreticalAndExperimentalStepDurationArray[i]
          + ',' +
          this.lastPointCorrectionFactorArray[i]
          + ',' +
          this.sumOfCurrentArray[i]
          + ',' +
          this.sumOfCurrentIntegratedArray[i].value
          + ',' +
          this.correctedSumOfCurrentIntegratedArray[i].value
          + ',' +
          this.postProcessingParamObj.unitOfCharge
          + ',' +
          finalCharge
          + ',' +
          result
          + '\r\n'
        );
      }
      //TODO - blob size memory overflow
      let blob = new Blob(dataRef, { type: 'text/csv' });
      return this.fileNavigator.writeFile(path,filename,blob,{replace:true})
    })
    .then((succ)=>{
      if(dataRef.length==0){
        this.toast.create({
          message: `There is no data stored for chosen date`,
          duration: 5000,
          position: 'top'
        }).present();
        return;
      }
      else{
        this.logError('AnalysisPage:  downloaded file','');
        newLoading.dismiss();
        //show toast
        this.toast.create({
          message: `File ready for transfer`,
          duration: 1000,
          position: 'top'
        }).present();
        let subject = 'Data from ' + this.deviceName;
        let body = 'Please find attached the processed data from the device ' + this.deviceName;
        this.EmailProvider.sendEmail(this.userEmail,path.concat(filename),subject,body);
      }
    })
    .catch((error)=>{
      newLoading.dismiss();
      this.logError('Error during Analysis file download ',error);
      this.toast.create({
        message: `File could not created for download`,
        duration: 3000,
        position: 'top'
      }).present();
    });
  }

  getStepNumber(objectArray,id){
    for(let i=0;i<objectArray.length;i++){
      if(objectArray[i].id == id){
        return objectArray[i].stepNumber;
      }
    }
  }


  /**
  * Check if all required fields have valid values before processing
  * data for Analysis
  *
  */


  validateFields(){
    let validating = this.loadingCtrl.create({
      content: 'Validating fields...'
    });
    return validating.present()
    .then(()=>{
        if(this.postProcessingParamObj.unitOfCharge == null ||
          this.postProcessingParamObj.unitOfCharge == undefined){
            validating.dismiss();
            this.SharedService.showToast('Enter a valid value for unit of charge','middle');
            this.unitOfChargeViewChild.setFocus();
            return;
        }

        if(this.postProcessingParamObj.offset == null ||
          this.postProcessingParamObj.offset == undefined){
            validating.dismiss();
            this.SharedService.showToast('Enter a valid value for Offset','middle');
            this.offsetViewChild.setFocus();
            return;
        }
        if(this.postProcessingParamObj.sensitivity == null ||
          this.postProcessingParamObj.sensitivity == undefined){
            validating.dismiss();
            this.SharedService.showToast('Enter a valid value for Sensitivity','middle');
            this.sensitivityViewChild.setFocus();
            return;
        }
        if(this.postProcessingParamObj.unitDependentOnSensitivity == null ||
          this.postProcessingParamObj.unitDependentOnSensitivity == undefined){
            validating.dismiss();
            this.SharedService.showToast('Enter a valid value for Unit','middle');
            this.unitDependentOnSensitivityViewChild.setFocus();
            return;
        }
        if(this.postProcessingParamObj.algorithm == null ||
          this.postProcessingParamObj.algorithm == undefined){
            validating.dismiss();
            this.SharedService.showToast('Enter a valid step for calculating charge','middle');
            this.algorithmViewChild.open();
            return;
        }
        validating.dismiss();
        this.process();

    }).catch((error)=>{
      this.logError('Error in validateFields',error);
    });
  }


  /**
  * Validate the fields needed for Calibration
  *
  */

  async validateBeforeCalibration(){
    try{

      if(this.postProcessingParamObj.unitDependentOnSensitivity == null ||
        this.postProcessingParamObj.unitDependentOnSensitivity == undefined){

          this.SharedService.showToast('Enter a valid value for Unit');
          this.unitDependentOnSensitivityViewChild.setFocus();
          throw Error('Enter a valid value for Unit of Result');
      }
      this.logError('Printing algorithm in validate: ' + JSON.stringify(this.postProcessingParamObj),'');
      if(this.postProcessingParamObj.algorithm == null ||
        this.postProcessingParamObj.algorithm == undefined){

          this.SharedService.showToast('Enter a valid algorithm for calculating final charge');
          this.algorithmViewChild.open();
          throw Error('Enter a valid algorithm for calculating Charge');
      }
      return;
    }
    catch(err){
      throw err;
    }
  }


  /**
  *  Function to get the correct step from the experiment method
  *  Returns a reference to the step in the array.
  */
  getStepByDatabaseRowIdFromMethod(method: methodParam,value:number): techniqueParam {
    //check listOfMeasures first and then preconditions
    for (let i=0, len=method.listOfMeasures.length; i<len; i++) {
      this.logError('printing measure stepNumber: ' + method.listOfMeasures[i].stepNumber + ' value ' + value,'');
      if (method.listOfMeasures[i].stepNumber == value) return method.listOfMeasures[i];
    }
    //will execute only if no step found in listOfMeasures array.
    for (let i=0, len=method.listOfPreconditions.length; i<len; i++) {
      if (method.listOfPreconditions[i].stepNumber == value) return method.listOfPreconditions[i];
    }
  }

  /**
  * Calculate current for a given array of response bits from the device
  * current = (data - zeroOffset) * scalingFactor
  * @param dataArray Array of strings
  * @param stepIdArray array holding the step Id of each data passed in dataArray
  * @param method methodParam object holding zeroOffset and scalingFactor required for calculating current
  * @return Array holding calculated current.
  */

  getCurrent(dataArray:string[],stepIdArray,method:methodParam){
    //this.logError('lenghts: ' + dataArray.length + ' steps ' + stepIdArray.length + ' method: ' + JSON.stringify(method),'');
    let currentIArray = [];
    let step;
    for(let i=0;i<dataArray.length;i++){
      step = this.getStepByDatabaseRowIdFromMethod(method,stepIdArray[i]);
      currentIArray.push(((dataArray[i] as any) - (step.zeroOffset as any) ) * (step.scalingFactor as any));
    }
    //this.logError('current array length: ' + currentIArray.length,'');
    return currentIArray;
  }



  /**
    Should always be called after validateFields
    calculates data for the following arrays.
    this.currentIntegratedArray //Stores chargePerStep (current * time interval betw two readings)
    this.sumOfCurrentArray // sum of current in each step
    this.sumOfCurrentIntegratedArray//sum of integrated current in each step.
    this.datetimeForCurrentArray //the last data's datetime is stored for plotting result.
    this.finalCharge //algorithm using multiple steps used for calculating final charge.
    this.resultArray //result calculated using final charge, offset and sensitivity
  **/

  process(){

    this.noOfMeasurementsPerStepArray = [];
    this.currentIntegratedArray = []; //Stores chargePerStep (current * time interval betw two readings)
    this.sumOfCurrentArray = []; // sum of current in each step
    this.sumOfCurrentIntegratedArray = []; //sum of integrated current in each step.
    this.datetimeForCurrentArray = [];//the last data's datetime is stored for plotting result.
    this.finalChargeArray = []; //algorithm using multiple steps used for calculating final charge.
    this.resultArray = []; ////(sumOfCurrentIntegrated - offset ) * sensitivity


    this.timeDiffArray = []; // time between data collection


    this.experimentalStepDurationArray = []; //stores experimental step duration - Ttot
    this.diffBetwTheoreticalAndExperimentalStepDurationArray = []; //Txs=Ttot-Tstep
    this.lastPointCorrectionFactorArray = []; //Txs/Tn where Tn is last point of step.
    this.correctedSumOfCurrentIntegratedArray = []; // Astep or value = Atot – (An. Txs/Tn)


    let resultObject = this.DataProcessingService.getSumOfCurrentIntegratedPerStep(this.dataForOneDay,this.dataForOneDay.method.listOfMeasures,this.postProcessingParamObj.includeFirstMeasure);

    this.noOfMeasurementsPerStepArray = resultObject.noOfMeasurementsPerStepArray;
    this.currentIntegratedArray = resultObject.currentIntegratedArray;
    this.sumOfCurrentArray = resultObject.sumOfCurrentArray; //sum of integrated current in each step.
    this.sumOfCurrentIntegratedArray = resultObject.sumOfCurrentIntegratedArray; //sum of integrated current in each step.
    this.datetimeForCurrentArray = resultObject.datetimeForCurrentArray;//the last data's datetime is stored for plotting result.
    this.timeDiffArray = resultObject.timeDiffArray; // time between data collection
    this.experimentalStepDurationArray = resultObject.experimentalStepDurationArray; //stores experimental step duration - Ttot
    this.diffBetwTheoreticalAndExperimentalStepDurationArray = resultObject.diffBetwTheoreticalAndExperimentalStepDurationArray; //Txs=Ttot-Tstep
    this.lastPointCorrectionFactorArray = resultObject.lastPointCorrectionFactorArray; //Txs/Tn where Tn is last point of step.
    this.correctedSumOfCurrentIntegratedArray = resultObject.correctedSumOfCurrentIntegratedArray; // Astep or value = Atot – (An. Txs/Tn)

    this.logError('No.of entries in correctedSumOfCurrentIntegratedArray: ' + this.correctedSumOfCurrentIntegratedArray.length,'');


    let step1 = this.postProcessingParamObj.algorithm.step1Index;
    let step2 = this.postProcessingParamObj.algorithm.step2Index;


    let resultForDisplay = {date: [], data:  []};
    for(let i=0;i<this.correctedSumOfCurrentIntegratedArray.length;i++){

      let finalCharge: number = null;
      let result: number = null;
      this.logError(' Iteration: ' + i + ' stepIdofValue: ' + this.correctedSumOfCurrentIntegratedArray[i].stepId + ' algorithmStepId: ' + step1,'');
      if(this.correctedSumOfCurrentIntegratedArray[i].stepId == step1){
        this.logError('This value is step1, FIND step2 data if available','');
        if(step2 == null){
          finalCharge = this.correctedSumOfCurrentIntegratedArray[i].value;
          result = (finalCharge - this.postProcessingParamObj.offset)/ this.postProcessingParamObj.sensitivity;
          resultForDisplay.date.push(this.datetimeForCurrentArray[i]);
          resultForDisplay.data.push(result);
          this.logError('Step2 is null: So Finalcharge: ' + this.correctedSumOfCurrentIntegratedArray[i].value ,'');
        }
        else{
          let j=i;
          for(let k=0;k<this.algorithmArray.length;k++){
            if(this.correctedSumOfCurrentIntegratedArray[j+1] != undefined || this.correctedSumOfCurrentIntegratedArray[j+1] != null){
              if(this.correctedSumOfCurrentIntegratedArray[j+1].stepId == step1){
                //To deal with start/stop of measurements and other inconsistencies
                this.logError('Next value is NOT null but is step1 again, go to next iteration','');
                j++;
                break;
              }
              if(this.correctedSumOfCurrentIntegratedArray[j+1].stepId == step2){
                finalCharge = this.correctedSumOfCurrentIntegratedArray[j].value - this.correctedSumOfCurrentIntegratedArray[j+1].value;
                result = (finalCharge - this.postProcessingParamObj.offset)/ this.postProcessingParamObj.sensitivity;
                resultForDisplay.date.push(this.datetimeForCurrentArray[i]);
                resultForDisplay.data.push(result);
                this.logError('Next value is NOT null and is Step2: Finalcharge: ' + this.correctedSumOfCurrentIntegratedArray[j].value + ' - ' + this.correctedSumOfCurrentIntegratedArray[j+1].value ,'');
                j++;
                break;
              }
              else{
                this.logError('Next value is not null but is NOT Step2: Go to next step','');
                j++;
                // finalCharge = result=0;
              }
            }
            else{
              this.logError('Next value is Null: Finalcharge: 0','');
              finalCharge = result=0;
              j++
              break;
            }
          }

        }

      }
      else{
        this.logError('This value is not step1, finalCharge=0','');
        finalCharge = result = 0;
      }
      this.finalChargeArray.push(finalCharge);
      this.resultArray.push(result);

    }
    this.logError('**********       Finished processing data       *************','');

    this.displayChart('Charge',resultForDisplay.date,resultForDisplay.data,'Time','Result in ' + this.postProcessingParamObj.unitDependentOnSensitivity);
  }

  /**
  * User chooses the algorithm to use for calculating final charge.
  * @param index Is the index chosen from algorithmArray select object.
  */

  setAlgorithm(index):void{
    let algorithmArrayIndex: number = +index;
    this.postProcessingParamObj.algorithm = this.algorithmArray[algorithmArrayIndex];
    this.logError('Algorithm SET ' + JSON.stringify(this.postProcessingParamObj.algorithm,null,4),'');
  }


  /**
  * Final charge can be calculated from a single step in the method, or combination
  * of two steps.
  * This function creates all possible step combinations for user to choose from.
  * Ex: If data collected from two steps, the combinations possbible for
  * calculating final charge are as follows:
  * Step 1
  * Step 2
  * Step 1 - Step 2
  * Step 2 - Step 1
  * @param method - Method containing step objects

  **/

  createStepCalculationOptions(method:methodParam){
    let length = method.listOfMeasures.length;
    let algorithmArrayIndex = 0;
    let option = '';
    this.algorithmArray = [];

    let step1;
    let step2;
    for(let i=0; i < length ;i++){
      step1 = method.listOfMeasures[i];
      this.logError('printing measure step ' + JSON.stringify(step1),'');
      //Add individual step as options.
      if(step1.save){
        this.algorithmArray.push({
          index: (algorithmArrayIndex),
          step1Description: step1.gain.description + ',' + step1.potential.description + ',' + step1.duration + 's @ ' + step1.dataFrequency+'ms',
          //step1Index: step1.databaseRowid,
          step1Index: step1.stepNumber,
          step2Description: null,
          step2Index: null,
          description: 'Step ' + (i+1)
        });
        algorithmArrayIndex++;
        for(let j=0 ; j< length; j++){
          step2 = method.listOfMeasures[j];
          option = 'Step ' + (i+1) + ' - Step ';
          if(i!=j){
            option = option + (j+1);
            if(step2.save){
              this.algorithmArray.push({
                index: (algorithmArrayIndex),
                step1Description: step1.gain.description + ',' + step1.potential.description + ',' + step1.duration + 's @ ' + step1.dataFrequency+'ms',
                // step1Index: step1.databaseRowid,
                step1Index: step1.stepNumber,
                step2Description: step2.gain.description + ',' + step2.potential.description + ',' + step2.duration + 's @ ' + step2.dataFrequency+'ms',
                // step2Index: step2.databaseRowid,
                step2Index: step2.stepNumber,
                description: option
              });
              algorithmArrayIndex++;
            }
          }
        }
      }
    }

  }

  /**
  * Opens calibrate page, passes experiment details and postProcessingParamObj as parameters
  *
  */
  async goToCalibrate(){

    try{
      await this.validateBeforeCalibration();
    }
    catch(err){
      this.logError('Error before going to Calibration page',err);
      return;
    }

    try{
      this.logError('Printing algorithm before entering calib page','');
      this.logError(JSON.stringify(this.postProcessingParamObj.algorithm),'');
      this.logError('Printing measures before entering calib page','');
      for(let i=0; i < this.chosenExperiment.method.listOfMeasures.length; i++){
        this.logError(JSON.stringify(this.chosenExperiment.method.listOfMeasures[i]),'');
      }
      this.navCtrl.push(CalibratePage, { page: 'analysis',
                                          index: 1,
                                          //experiment: this.chosenExperiment,
                                          listOfMeasures: this.chosenExperiment.method.listOfMeasures,
                                          postProcessingParamObj: this.postProcessingParamObj,
                                          algorithm: this.postProcessingParamObj.algorithm,
                                        includeFirstMeasure: this.postProcessingParamObj.includeFirstMeasure });
    }
    catch(err){
      this.logError('Error before going to Calibration page',err);
      this.SharedService.presentAlert('Error',err,'Dismiss');
    }
  }


  //create the help page
  help(){
    this.navCtrl.push(HelpModalPage, { page: 'analysis', index: 1, stepsArray: null});
  }


  /**
  * Called in unrecoverable cases, an alert is shown to the user and a debug file with log written to the phone.
  */
  fatalErrorNeedsAttention(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    this.logError(message,error);
    this.SharedService.presentAlert('Fatal Error',message,'DISMISS');
    this.SharedService.saveForLog((new Date().toISOString()).concat(message).concat(errStackTrace));
    this.SharedService.downloadDebugFile(true,message);
  }


  /**
  * Return a file name in string format using a date.
  * @param date passed as string
  * @return string in the following format yyyy-mm-dd_HH_MM_SS
  */

  convertDateForFileName (convertDate) {

		let date = new Date(convertDate);
    let mmString: string;
    let ssString: string;
    let mm = date.getMinutes();
    let ss = date.getSeconds();
    if(mm < 10){
      mmString = '0' + String(mm);
    }
    else{
		    mmString = String(mm);
    }
    if(ss < 10){
      ssString = '0' + String(ss);
    }
    else {
      ssString = String(ss);
    }
    let filename = this.DatabaseService.convertDateToYYYYMMDD(date) + '_' + date.getHours() + '_' + mmString + '_' + ssString;

    return filename;
	}

  logError(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    console.log('AnalysisPage: ' + message + ' ' + errStackTrace);
    this.SharedService.saveForLog((new Date().toISOString() + ': AnalysisPage: ').concat(message).concat(errStackTrace));
  }

  // ionic lifecycle functions.

  ionviewDidLeave(){
    this.userIsViewingChart = false;
  }

  ionViewWillLeave(){
    this.userIsViewingChart = false;
  }

}
