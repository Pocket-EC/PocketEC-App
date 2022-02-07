import { Component,ViewChild,NgZone,ChangeDetectorRef } from '@angular/core';
import { NavController,Platform,ToastController,AlertController,LoadingController } from 'ionic-angular';
import { Chart } from 'chart.js';
import { HomePage} from '../home/home';
import { DatabaseProvider } from '../../providers/database/database';
import { SharedserviceProvider } from '../../providers/sharedservice/sharedservice';
import { StatusUpdateProvider } from '../../providers/statusupdateservice/statusupdateservice';
import { File } from '@ionic-native/file';
import { BackgroundMode } from '@ionic-native/background-mode';
import { EmailProvider } from '../../providers/email/email';




@Component({
  selector: 'page-charts',
  templateUrl: 'charts.html'
})
export class ChartsPage {


  @ViewChild('lineCanvas') lineCanvas;
  @ViewChild('temperatureLineCanvas') temperatureLineCanvas;
  @ViewChild('datePicker') datePicker; //need this to open datetime through DATE button click
  lineChart: Chart;
  temperatureLineChart: Chart;

  dataForOneDay: experimentDataObject = {
                            length: 0,
                            dataArray: [],
                            chartDateArray: [],
                            currentArray: [],
                            temperatureArray: [],
                            stepIdArray: [],
                            noOfMeasurementsPerStepArray:[],
                            experimentId: null,
                            method: null,
                            stepStartTimeArray:[]
                          };

  listOfExperiments:{name: string, experimentId: number, dateCreated: string,postProcessingParamsId:number}[];
  chosenExperiment = {
    name: null,
    experimentId: null,
    dateCreated: null
  };
  currentExperimentId: number = null;
  graphTitle: string;
  avgGraphData = [];
  avgXAxisLabel = [];
  avgCommandArray = [];
  avgrLoadAndIntZArray = [];
  avgSamplingSetupArray = [];
  currentIArray = [];
  timezoneOffset = [];

  showNoDataView: boolean = false; // View flag - No chart displayed to user if no data found in db
  userIsViewingChart: boolean = false;
  chartRendered: boolean = false;
  averageOver: number = 50;


  gainArrayIndex:number = 0;
  potentialArrayIndex: number = 0;

  setDownloadMode: boolean= false; //by default download by day.
  //averagedData
  chartSetToAveragedMode: boolean = false;
  chartSetToCurrentView: boolean = false;
  flagForDatabaseTransaction: boolean = false;

  deviceName; //name of current bluetooth device - populated from SharedService.
  userEmail;
  backgroundModeActivated:boolean = false;
  userUpdate: string;

  // IMPORTANT services:
  // Chart commands retrieved from localstorage.
  // SUBSCRIPTION SERVICES initialized - for displaying new data on chart while sampling

  constructor(public platform: Platform,
    private ngZone: NgZone,
    public navCtrl: NavController,
    public toast: ToastController,
    private alert: AlertController,
    private loadingCtrl: LoadingController,
    public fileNavigator: File,
    private EmailProvider: EmailProvider,
    private backgroundMode: BackgroundMode,
    public DatabaseService: DatabaseProvider,
    public SharedService: SharedserviceProvider,
    public StatusUpdateService: StatusUpdateProvider,
    public cdr: ChangeDetectorRef
  ) {

    this.platform.ready().then(()=>{

      //subscribe to delete all data action in settings page.

      this.SharedService.renewIfDeletedAllData().subscribe((flag)=>{

        this.logError('Subscription for data deletion called: ' + flag,'');
        //delete all data in buffer and update chart.
        if(flag){
          if(this.dataForOneDay != null && this.dataForOneDay != undefined){
            this.dataForOneDay.length = 0;
            this.dataForOneDay.dataArray = [];
            this.dataForOneDay.chartDateArray = [];
            this.dataForOneDay.stepIdArray = [];
            this.dataForOneDay.temperatureArray = [];
            this.dataForOneDay.noOfMeasurementsPerStepArray = [];
            this.dataForOneDay.experimentId = null;
            this.dataForOneDay.method = null;
            this.dataForOneDay.stepStartTimeArray = [];
            this.toggleAveragedViewMode(false); //averaged data view set to false by default
          }
        }

      });

      //Refresh user centric update messages about current measurement status

      this.StatusUpdateService.subscribeToStatusUpdate().subscribe((update)=>{
        this.currentExperimentId = SharedService.getCurrentExperimentId();
        if(this.currentExperimentId == null || this.chosenExperiment.experimentId == null ){
          // no experiment is running
        }
        else{
          if(this.chosenExperiment.experimentId == this.currentExperimentId){
            this.ngZone.run(()=>{
              this.userUpdate = update;
            });
          }
          else{
            //need not post updates here for the user to see.
          }
        }
      });

      //Refresh chart when new data is sampled from device and stored (listens to DataReaderService)

      this.SharedService.subscribeToNewExperimentId().subscribe((experimentId)=>{
        if(experimentId == null){
          this.logError('experimentId is null, do nothing ','');
        }
        else if(this.chosenExperiment.experimentId == null){
          this.logError('chosenExperiment.experimentId is null, wait for loadChosenExperiment to be called ','');
        }
        else if(this.chosenExperiment.experimentId == experimentId){ //} parseInt(experimentId) ){
          this.updateChartsWithNewData(this.SharedService.getLatestDataForCharts());
        }
        else{
          this.logError('Latest data not updated as viewing a different experiment data ','');
        }

      });
    }); //End of platform ready call function


    this.backgroundMode.on('deactivate').subscribe(()=>{
      this.backgroundModeActivated = false;
      this.logError( 'BGM deactivated ', '');
      //renew data from localStorage
      if(this.userIsViewingChart){
        //this.latestData();
        this.loadChosenExperiment();
      }
    },(error)=>{
      this.logError(' BGM deactivate handler threw an error ',error);
    });

    this.backgroundMode.on("activate").subscribe(()=>{
      this.logError(' BGM activated at ', new Date().toISOString());
      this.backgroundModeActivated = true;
      //testing large datasets storage in sqlite when in backgroundmode
      // this.DatabaseService.createDummyDataInSqlite().then(()=>{
      //   this.logError('10,000 lines of dummy data created when app was in backgroundmode','');
      // },(error)=>{
      //   this.logError('error creating the dataset ',error);
      // });
    },(error)=>{
      this.logError('BGM activate handler threw an error ',error);
    });

  }//End of constructor

  // set boolean that user is viewing charts.

  ionViewDidEnter () {
    this.userIsViewingChart = true;
  }

  //Check authentication and renew averageOver.
  // Have this in addition as sometimes, charts is still viewable after user logs in and logs out. HACK

  ionViewWillEnter(){
    this.SharedService.getAuth().then((val) => {
      if(!val){
        this.navCtrl.setRoot(HomePage);
        return;
      }
      else{
        this.userIsViewingChart = true;
        this.logError('userIsViewingChart set in ionViewWillEnter ' + true,'');
        this.listOfExperiments = [];
        this.getListOfExperiments();
        if(!this.chartRendered){
          this.showNoDataView = false;
          //this.logError('ionViewWillEnter triggers latestData','');
          // this.latestData();
          this.loadChosenExperiment();

        }else{
          this.logError('Do nothing so that old chart page view is maintained. ','');
        }
      }
    });
    this.SharedService.getDevice().then((device) => {
      if(device != null) {
        this.deviceName = device.name;
      }
      // this.logError('Charts: Device name  ' + this.deviceName, new Date().toISOString());
    });
    this.userEmail = this.SharedService.getUserEmail();
  }


  //This should only be called if viewed data is todays' data.

  updateChartsWithNewData(latestDataForCharts:experimentDataObject){
    try{

      if(latestDataForCharts == undefined || latestDataForCharts == null || latestDataForCharts.length == 0) return; //do nothing
      this.logError('there is data in latestDataForCharts: update data','');
      if(this.dataForOneDay == undefined || this.dataForOneDay == null){
        this.logError('Charts have not been rendered with a database call yet','');
      }
      if(this.showNoDataView){ //reset it as there is data to be viewed
        this.showNoDataView = false;
        this.logError('showNoDataView set to false as there is new data from DataReaderService','');
      }
      let currentToPrint = 0;

      let step = this.getStepByDatabaseRowIdFromMethod(this.dataForOneDay.method,latestDataForCharts.stepIdArray[0]);
      if(step == undefined || step == null){
        throw Error('Could not find step parameters');
      }
      for (let j = 0; j < latestDataForCharts.length; j++) { //TODO have to make sure data is continuous here.
        this.dataForOneDay.dataArray.push(latestDataForCharts.dataArray[j]); //update global copy
        this.dataForOneDay.chartDateArray.push(latestDataForCharts.chartDateArray[j]);
        this.dataForOneDay.stepIdArray.push(latestDataForCharts.stepIdArray[j]);
        this.dataForOneDay.temperatureArray.push(latestDataForCharts.temperatureArray[j]);
        currentToPrint = ((latestDataForCharts.dataArray[j] as any) - (step.zeroOffset as any) ) * (step.scalingFactor as any);
        this.currentIArray.push(currentToPrint);
      }


      this.dataForOneDay.length = this.dataForOneDay.length + latestDataForCharts.length;
      this.logError('Size of this.dataForOneDay AFTER update ' + this.dataForOneDay.length,'');
      if(!this.userIsViewingChart){
        //do not render chart
        this.logError('User is not viewing chart - do not update chart ', new Date().toISOString());
      }
      else if(this.backgroundModeActivated){
        this.logError('In BGM - do not update chart ', new Date().toISOString());
        //when background mode is deactivated, latestData () will be executed.
      }
      else{
        this.toggleAveragedViewMode(this.chartSetToAveragedMode);
      }
    }
    catch(err){
      this.logError('Error updating Charts with new data ',err);
      this.SharedService.downloadDebugFile(true,'An error occured while updating Charts with new Step data');

    }
  }

  /**
  *  To get the correct step from the experiment method
  *  Returns a reference to the step in the array.
  */
  getStepByDatabaseRowIdFromMethod(method: methodParam,uniqueRowId:number): techniqueParam {
    //check listOfMeasures first and then preconditions
    for (let i=0, len=method.listOfMeasures.length; i<len; i++) {
      if (method.listOfMeasures[i].stepNumber == uniqueRowId) return method.listOfMeasures[i];
    }
    //will execute only if no step found in listOfMeasures array.
    for (let i=0, len=method.listOfPreconditions.length; i<len; i++) {
      if (method.listOfPreconditions[i].stepNumber == uniqueRowId) return method.listOfPreconditions[i];
    }
  }

  /*
   * Is called every time user views chart page
  */
  // latestData() {
  //   //HAVE TO REMEMBER CHARTSPAGE STATE HERE to view the last rendered data.
  //   this.logError('latestData called','');
  //   this.getDayDataAndDisplay();
  //
  // }





  //Retrieves data from local storage for an experiment specified in chosenExperiment and displays on chart.

  loadChosenExperiment(){
    if(this.flagForDatabaseTransaction){
      this.logError('Transaction in progress','return');
      return;
    }
    this.flagForDatabaseTransaction = true;

    //let experimentDetails: {experimentId: number, name: string, count: number, method: methodParam };
    let experimentId = null;
    if(this.chosenExperiment != null) {
      experimentId = this.chosenExperiment.experimentId;
    }
    //experimentId can be null.

    //Returns object {experimentId: number, name: string, count: number, method: methodParam,dateCreated: string};
    return this.DatabaseService.getExperimentDetails(experimentId)
    .then(experimentDetails=>{
      if(experimentDetails.experimentId == null){
        //no data to view.
        this.logError('No data to view for: ' + JSON.stringify(experimentDetails.experimentId),'');
        this.flagForDatabaseTransaction = false;
        this.SharedService.showToast('No experiments are available to view');
        this.showNoDataView = true;
        return;
      }
      //only executed if experimentDetails is not null.
      this.logError('experimentDetails obtained ' + JSON.stringify(experimentDetails),'');

      this.chosenExperiment.name = experimentDetails.name;
      this.chosenExperiment.dateCreated = experimentDetails.dateCreated;
      this.chosenExperiment.experimentId = experimentDetails.experimentId;


      this.graphTitle = 'Experiment: ' + experimentDetails.name;
      let count = experimentDetails.count;
      let startIndex = 0;
      let pageSize = 50000;
      let totalCount = count;
      let noOfPages = Math.round(totalCount/pageSize);
      //empty global arrays holding old data.
      this.avgGraphData = [];
      this.avgXAxisLabel = [];
      this.dataForOneDay.dataArray = [];
      this.dataForOneDay.chartDateArray = [];
      this.dataForOneDay.stepIdArray = [];
      this.dataForOneDay.temperatureArray = [];

      this.dataForOneDay.length = 0;
      this.dataForOneDay.method = experimentDetails.method; //this.cloneMethod(experimentDetails.method);
      this.dataForOneDay.experimentId = experimentDetails.experimentId;

      this.currentIArray = [];

      if(count == 0){
        this.logError('No data to view for: ' + JSON.stringify(experimentDetails.experimentId),'');
        this.flagForDatabaseTransaction = false;
        this.displayChart(this.graphTitle,this.dataForOneDay.chartDateArray,this.dataForOneDay.dataArray,'Time','Response (bits)');
        this.SharedService.showToast('No data has been recorded for this experiment');
      }
      else{
        let newLoading = this.loadingCtrl.create({
          content: 'Retrieving data from database..'
        });
        return newLoading.present()
        .then(()=>{
          // return this.getDataFromDatabase(startIndex,pageSize,totalCount,noOfPages,0,this.chartDate)
          return this.getExperimentData(startIndex,pageSize,totalCount,noOfPages,0,experimentDetails.experimentId,experimentDetails.method)
        })
        .then(()=>{
          newLoading.dismiss();
          this.flagForDatabaseTransaction = false;
          this.toggleAveragedViewMode(this.chartSetToAveragedMode);
        })
        .catch((error)=>{
          newLoading.dismiss();
          this.logError('Could not finish database request ',error);
          this.flagForDatabaseTransaction = false;
          this.SharedService.presentAlert('Fatal error','Data from local storage could not be retreived', 'DISMISS');
        });
      }
    },(error)=>{
      this.logError('Could not finish count database request ',error);
      this.flagForDatabaseTransaction = false;
      this.SharedService.presentAlert('Fatal error','Data from local storage could not be retreived', 'DISMISS');
    });

  }

  getExperimentData(startIndex,pageSize,totalCount,noOfPages,offset,experimentId,method){
    return this.DatabaseService.getExperimentData(experimentId,pageSize,offset)
    .then(dataForOneDay => { //chartData interface
      this.dataForOneDay.dataArray = this.dataForOneDay.dataArray.concat(dataForOneDay.dataArray);
      this.dataForOneDay.chartDateArray = this.dataForOneDay.chartDateArray.concat(dataForOneDay.chartDateArray);
      this.dataForOneDay.stepIdArray = this.dataForOneDay.stepIdArray.concat(dataForOneDay.stepIdArray);
      this.dataForOneDay.temperatureArray = this.dataForOneDay.temperatureArray.concat(dataForOneDay.temperatureArray);
      this.currentIArray = this.currentIArray.concat(this.calculateCurrent(dataForOneDay.dataArray,dataForOneDay.stepIdArray,this.dataForOneDay.method));
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






  /***
  *  average data mode subroutines for deciding which data array is displayed on chart
  *  @param setChartToAveragedMode - true forces chart to be displayed as an averaged dataset.
  *  false - forces chart to be rendered as is if no. of data points < 3000 and auto averaged if data > 3000 points
  *  current or bits displayed.
  *
  ****/

  toggleAveragedViewMode(setChartToAveragedMode:boolean){
    this.chartSetToAveragedMode = setChartToAveragedMode;

    let dataLength = this.dataForOneDay.length;
    //trigger data averaging using the data array already displayed .
    if(setChartToAveragedMode){
      let dataSubset;
      let xAxisLabel = 'Time';
      let yAxisLabel = 'Response (bits)';
      this.avgGraphData = [];
      this.avgXAxisLabel = [];


      if(this.chartSetToCurrentView){
        if(this.currentIArray.length == 0){
          //this.currentIArray = this.calculateCurrent(this.dataForOneDay.dataArray,this.dataForOneDay.zeroOffsetArray,this.dataForOneDay.scalingFactorArray);
          this.currentIArray = this.calculateCurrent(this.dataForOneDay.dataArray,this.dataForOneDay.stepIdArray,this.dataForOneDay.method);
        }
        dataSubset = this.getAveragedDataSet(this.averageOver,dataLength,this.currentIArray,this.dataForOneDay.chartDateArray,this.dataForOneDay.stepIdArray);
        yAxisLabel = 'Current in '+this.dataForOneDay.method.unitOfCurrent;
      }
      else{
        dataSubset = this.getAveragedDataSet(this.averageOver,dataLength,this.dataForOneDay.dataArray,this.dataForOneDay.chartDateArray,this.dataForOneDay.stepIdArray);
      }

      let avgGraphTitle = this.chosenExperiment.name.concat('- Averaged data');
      this.avgGraphData = dataSubset.newDataArray;
      this.avgXAxisLabel = dataSubset.newAxisArray;
      this.displayChart(avgGraphTitle,dataSubset.newAxisArray,dataSubset.newDataArray,xAxisLabel,yAxisLabel);
    }
    else{

      //check dataLength to cull array if necessary.
      if(dataLength > 3000){
        //show culled dataset - averaging used for now.
        let downSizeFactor = Math.round(dataLength / 1000);
        this.logError('Charts: When data is > 3000 cul data by a factor of ' + downSizeFactor,'');
        if(this.chartSetToCurrentView){
            if(this.currentIArray.length == 0){
              this.currentIArray = this.calculateCurrent(this.dataForOneDay.dataArray,this.dataForOneDay.stepIdArray,this.dataForOneDay.method);
            }
            let culledData = this.getAveragedDataSet(downSizeFactor,dataLength,this.currentIArray,this.dataForOneDay.chartDateArray,this.dataForOneDay.stepIdArray);
            this.displayChart(this.graphTitle,culledData.newAxisArray,culledData.newDataArray,'Time','Current in '+this.dataForOneDay.method.unitOfCurrent);
        }
        else{

            let culledData = this.getAveragedDataSet(downSizeFactor,dataLength,this.dataForOneDay.dataArray,this.dataForOneDay.chartDateArray,this.dataForOneDay.stepIdArray);
            this.displayChart(this.graphTitle,culledData.newAxisArray,culledData.newDataArray,'Time','Response (bits)');

        }
      }
      else{
        if(this.chartSetToCurrentView){
          if(this.currentIArray.length == 0){
            this.currentIArray = this.calculateCurrent(this.dataForOneDay.dataArray,this.dataForOneDay.stepIdArray,this.dataForOneDay.method);
          }
          this.displayChart(this.graphTitle,this.dataForOneDay.chartDateArray,this.currentIArray,'Time','Current in '+this.dataForOneDay.method.unitOfCurrent);
        }
        else{
          this.displayChart(this.graphTitle,this.dataForOneDay.chartDateArray,this.dataForOneDay.dataArray,'Time','Response (bits)');
        }
      }
    }
  }


  getAveragedDataSet(averageOver,dataLength,dataArray,xAxisArray,stepIdArray){
    let newDataArray = [];
    let newAxisArray = [];
    let newStepIdArray = [];

    for (let i = 0; i < dataLength; i++) {
      i = i + (averageOver -1);
      //enter the last date in the window being averaged.
      newAxisArray.push(xAxisArray[i]);
      newStepIdArray.push(stepIdArray[i]);

      let subArray = dataArray.slice((i-(this.averageOver-1)),i); //subarray of previous data with lenght from averageOver
      newDataArray.push(this.arrayAverage(subArray));
      if((dataLength - i)<= averageOver){
        //discard rest of data for now.
        break;
      }
    }
    this.logError('Printing avg array data length ' + newDataArray.length,'');
    return {newDataArray: newDataArray,newAxisArray:newAxisArray,newStepIdArray: newStepIdArray};
  }

  /*****
  * returns an average of an array.
  ******/

  arrayAverage(array){
    var sum = 0;
    for( var i = 0; i < array.length; i++ ){
        sum += parseInt( array[i], 10 ); //don't forget to add the base
    }
    var avg = sum/array.length;
    return avg;
  }


  /*****
  ** Increment(true)/decrement (false) in 10s
  *****/

  changeAvgOver(flag){
    var num = +this.averageOver;
    this.logError('printing average over ' + this.averageOver,'');
    // num = parseInt(this.averageOver,10);
    if(flag){
      num = num + 10;
    }
    else{
      if(num <= 10){
        this.SharedService.showToast('Cannot decrease number further');
      }
      else{
         num = num - 10;
      }
    }
    // this.averageOver = String(num); //Typescript compile error.
    this.averageOver = num; // TODO compliles, should make sure this is a valid number here.
    // this.averageOver = num.toLocaleString();
    this.toggleAveragedViewMode(this.chartSetToAveragedMode);
  }

  /**
  * Allows user to toggle the chart/graph to view either the current or raw data in response bits.
  * @param boolean
  */
  toggleCurrentView(setChartToCurrentView:boolean){
    if(this.currentIArray.length == 0){
      this.currentIArray = this.calculateCurrent(this.dataForOneDay.dataArray,this.dataForOneDay.stepIdArray,this.dataForOneDay.method);
    }
    this.toggleAveragedViewMode(this.chartSetToAveragedMode);
  }


  calculateCurrent(dataArray,stepIdArray,method){
    let currentIArray = [];
    let step;
    for(let i=0;i<dataArray.length;i++){
      //this.logError('printing stepIdArray value ' + stepIdArray[i],'');
      step = this.getStepByDatabaseRowIdFromMethod(method,stepIdArray[i]);
      currentIArray.push(((dataArray[i] as any) - (step.zeroOffset as any) ) * (step.scalingFactor as any));
    }
    return currentIArray;
  }




  /*
   Initializes lineChart with given data (label, xaxis array, yaxis array)

   if not using graphTitle - enter empty string
  */

  displayChart(graphTitle,xAxisDataArray,graphDataArray,xAxisLabel?, yAxisLabel?) {

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

      // check if its old experiment.
      if(this.chosenExperiment.experimentId != null || this.currentExperimentId !=null){
        if(this.chosenExperiment.experimentId != this.currentExperimentId){
        // if(!this.isChartDateTodaysDate(new Date(),this.chartDate)){
          this.ngZone.run(()=>{
            this.userUpdate = ''; //reset to empty string as user is viewing older data
          });
        }
      }

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
      this.logError('Error while rendering chart ',error);
      this.chartRendered = false;

    });
    this.logError('Time after chart was rendered ' + new Date(),'');
    this.chartRendered = true;
  }


  //list of user specific experiments.
  async getListOfExperiments(){

    this.listOfExperiments = await this.DatabaseService.getListOfExperiments(this.SharedService.getUserId());
    //this.logError('List of experiments from database: ' + this.listOfExperiments.length,'');

    this.cdr.detectChanges();
  }

  // loadChosenExperiment(){
  //   this.getDayDataAndDisplay(); //will use the rowid stored in chosenExperiment object to get experiment data.
  // }

  viewTemperatureChart(){
    //graphTitle,xAxisLabel,graphData) {

    //update old chart with new data
    //check if undefined - the first linechart render may not have been called yet


    let i=0;
    while(this.temperatureLineCanvas == undefined){
      setTimeout(i++,1000);
      if(i==2) {
        alert('Canvas not ready for display');
        break;
      }
    }

      let graphTitle = 'Temperature';
      if(this.temperatureLineChart != undefined && this.temperatureLineChart !=null){
        this.logError('Linechart available, update with new data','');
        this.temperatureLineChart.data.datasets[0].label = graphTitle;
        this.temperatureLineChart.data.labels = this.dataForOneDay.chartDateArray;
        this.temperatureLineChart.data.datasets[0].data = this.dataForOneDay.temperatureArray;
        this.temperatureLineChart.options.title.text = graphTitle;
        this.temperatureLineChart.update();


        return;
      }

      this.temperatureLineChart = new Chart(this.temperatureLineCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: this.dataForOneDay.chartDateArray,
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
            data: this.dataForOneDay.temperatureArray,
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
                labelString: 'Time'
              }
            }],
            yAxes:[{
              scaleLabel: {
                display: true,
                labelString: 'Temperature (C)'
              }
            }]
          }
        }
      },(error)=>{
        this.logError('An Error occured while rendering the graph ',error);

      });
    // },(dbError)=>{
    //   this.logError('Data could not be retrieved from local database',dbError);
    // });
  }



    // Get last entered row from sqlite and use date
    //(format is an object containing string - yyyy-mm-dd) from that result to get latest data


  /*
   Back arrow and forward arrow clicks to change date of data displayed
   */

  // changeDate(changeDayBy) {
  //   // - 1 decrease day and +1 increases day by 1
  //   let now = new Date();
  //   let today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() ));
  //   let userReqDate = new Date(Date.UTC(this.chartDate.getUTCFullYear(), this.chartDate.getUTCMonth(), this.chartDate.getUTCDate() ));
  //
  //   userReqDate.setDate(userReqDate.getDate() + changeDayBy);
  //
  //   if(userReqDate.getTime() > today.getTime()){
  //
  //     this.SharedService.presentAlert('Invalid Date','Chosen date ' + userReqDate + ' is in the future, cannot complete request','Dismiss');
  //
  //     // //reset both date object and string to todays date.
  //     // this.chartDate = new Date();
  //     // this.chartDateString = this.chartDate.toISOString(); //BUG this triggers another ion-change
  //     return;
  //   }
  //
  //   this.chartDate.setDate(this.chartDate.getDate() + changeDayBy);
  //   //Jump to getChartDataByDate() by setting chartdatestring. Changing chartDateString triggers ionchange on datetime.
  //   this.chartDateString = this.chartDate.toISOString();
  //   //HACK reset average view to raw view here.
  //
  // }

  /* Date button click opens the datetime component using ViewChild*/

  openDateTime(){
    this.datePicker.open();
  }

  /*subroutine to check if data on chart is from today (need to know this to update the view with new values while sampling).*/

  isChartDateTodaysDate(today,chartViewDate){
    if(today.getUTCDate()==chartViewDate.getUTCDate()){
      return true;
    }
    else{
      return false;
    }
  }



  //TODO - make sure this is the same subroutine as in database.ts

  convertDateToYYYYMMDD (convertDate) {

    let yyyymmddDate;
    if (convertDate == null)
        yyyymmddDate = new Date();
    else
        yyyymmddDate = new Date(convertDate);

    let date = yyyymmddDate.getUTCDate();
    let month = yyyymmddDate.getUTCMonth() + 1; //January is 0!
    let year = yyyymmddDate.getUTCFullYear();
    if (date < 10) {
        date = '0' + date;
    }
    if (month < 10) {
        month = '0' + month;
    }
    yyyymmddDate = year + '-' + month + '-' + date;
    return yyyymmddDate;
  }




// True- entire stored dataset
// false - download data for displayed chart day only.

  toggleDownloadMode(value){
    this.setDownloadMode = value;
    if(value){
      let alert = this.alert.create({
        title: 'Are you sure?',
        subTitle: 'Sampling frequency may be affected while creating the file for download. To proceed, choose Ok and click on the Download button',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: data => {
              this.logError('Cancel clicked','');
              this.setDownloadMode = false;
              return;
            }
          },
          {
            // text: 'Continue',
            // handler: data => {data

            //   this.downloadCSV();
            // }
            text: 'Ok',
            handler: data => {data
              this.logError('Proceed to download ' + data,'');
              //this.downloadCSV();
            }
          }
        ]
      });
      alert.present();
    }

  }


/**
* Download from chartspage buffer instead of from database.
*/

downloadByExperiment() {

  let path = this.fileNavigator.externalDataDirectory;

  let dataRef = [];

  let filename = this.convertDateForFileName(new Date());
  filename = filename + '_data.csv';

  this.logError('Downloading to ' + path + ' file ' + filename,'');

  let dataLength = this.dataForOneDay.length;
  if(dataLength == 0){
    this.SharedService.presentAlert('No data','No data found on device for this experiment','Dismiss');
    return;
  }


  let newLoading = this.loadingCtrl.create({
    content: 'Preparing file..'
  });
  return newLoading.present()
  .then(()=>{
    //Start creating array of string with comma separated data.
    dataRef.push('Data from: ' + this.DatabaseService.convertDateToExcelFormat_NoTimezoneoffset(this.dataForOneDay.chartDateArray[0]) +' \r\n');
    dataRef.push('Total No. of data points: ' + this.dataForOneDay.length +' \r\n');
    dataRef.push('Method name: ' + this.dataForOneDay.method.name +' \r\n');
    let step;
    for(let i=0; i<this.dataForOneDay.method.listOfPreconditions.length; i++){
      step = this.dataForOneDay.method.listOfPreconditions[i];
      dataRef.push('Precondition Step' + (i+1) + ':: \r');
      dataRef.push('Gain: ' + step.gain.description + ' Potential: ' + step.potential.description + 'Save data: ' + step.save + ' Duration ' + step.duration+'s');
      if(step.save){
        dataRef.push('@ ' + step.dataFrequency+'ms');
      }
      dataRef.push('\r\n');
    }
    for(let i=0; i<this.dataForOneDay.method.listOfMeasures.length; i++){
      step = this.dataForOneDay.method.listOfMeasures[i];
      dataRef.push('Measures Step ' + (i+1) + ':: \r');
      dataRef.push('Gain: ' + step.gain.description + ' Potential: ' + step.potential.description + 'Save data: ' + step.save + ' Duration ' + step.duration+'s');
      if(step.save){
        dataRef.push('@ ' + step.dataFrequency+'ms');
      }
      dataRef.push('\r\n');
    }
    dataRef.push(' \n\n');
    dataRef.push('DateTime Excel Format, Raw sensor data, Zero-offset, Scaling factor,Current,Unit of Current,Temperature, Gain and Potential,rLoad and Internal Zero,Sampling setup\r\n');

    this.logError('-----  ++++++++ ------- ','');
    this.logError('Start writing data in csv format ','');
    this.logError('-----  ++++++++ ------- ','');
    //Start iterating through data Array

    let temperature;
    for (let i = 0; i < this.dataForOneDay.length; i++) {

      step = this.getStepByDatabaseRowIdFromMethod(this.dataForOneDay.method,this.dataForOneDay.stepIdArray[i]);

      if(this.dataForOneDay.temperatureArray[i]!= null){
        temperature = this.dataForOneDay.temperatureArray[i];
      }
      else{
        temperature = '';
      }

      dataRef.push(
          this.DatabaseService.convertDateToExcelFormat_NoTimezoneoffset(this.dataForOneDay.chartDateArray[i])
          + ',' +
          this.dataForOneDay.dataArray[i]
          + ',' +
          step.zeroOffset
          + ',' +
          step.scalingFactor
          + ',' +
          this.currentIArray[i]
          + ',' +
          this.dataForOneDay.method.unitOfCurrent
          + ',' +
          temperature
          + ',' +
          step.gain.description + ' ' + step.potential.description
          + ',' +
          step.gain.rLoad.description + ' ' + step.potential.intZ.description
          + ',' +
          step.duration + 's @ ' + step.dataFrequency+'ms'
          + '\r\n'
        );

    }


    //create a blob from the array of strings to write to file.

    let blob = new Blob(dataRef, { type: 'text/csv' });
    return this.fileNavigator.writeFile(path,filename,blob,{replace:true})

  })
  .then((succ)=>{
    newLoading.dismiss();
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
        message: `File ready for downloading`,
        duration: 3000,
        position: 'top'
      }).present();
      let subject = 'Data from ' + this.deviceName;
      let body = 'Please find attached all stored sensor data from device ' + this.deviceName;
      this.EmailProvider.sendEmail(this.userEmail,path.concat(filename),subject,body);
    }
  })
  .catch((error)=>{
    this.logError('An error during file download occured ',error);
    newLoading.dismiss();
    this.toast.create({
      message: `File could not created for download`,
      duration: 3000,
      position: 'top'
    }).present();
  });
}
  /*
  * If day view download requested,
  * download from loaded array buffer instead of reading from database.
  */

  downloadCSVByDate() {

    let path = this.fileNavigator.externalDataDirectory; //'file:///';
    // if(this.chartDate == null){
    //   this.SharedService.presentAlert('Fatal Error','Date could not be determined for downloading','Dismiss');
    //   return;
    // }

    let dataRef = [];
    // let chartDateForQuery = this.convertDateToYYYYMMDD(this.chartDate)
    let filename = this.convertDateForFileName(new Date());
    filename = filename + '_data.csv';

    this.logError('download to ' + path + ' file ' + filename,'');

    let dataLength = this.dataForOneDay.length;
    if(dataLength == 0){
      this.SharedService.presentAlert('No data','No data found on device for this date','Dismiss');
      return;
    }


    let newLoading = this.loadingCtrl.create({
      content: 'Preparing file..'
    });
    return newLoading.present()
    .then(()=>{
      //Get timezoneOffset to process data for excel file.
      //return this.DatabaseService.getTimezoneOffset(chartDateForQuery)
      return this.DatabaseService.getTimezoneOffset('') //rewrite for experimentId TODO temporary.
    })
    .then((timezoneOffsetArray)=>{
      if(timezoneOffsetArray.length == 0){
        this.logError('timezoneOffset length is 0','');
        this.SharedService.presentAlert('Error','Timezone offset could not be determined','Ok');
        return;
      }
      this.timezoneOffset = timezoneOffsetArray[0];


      //Start creating array of string with comma separated data.
      dataRef.push('Data from: ' + this.DatabaseService.convertDatetoExcelFormat(this.timezoneOffset,this.dataForOneDay.chartDateArray[0]) +' \r\n');
      dataRef.push('Total No. of data points: ' + this.dataForOneDay.length +' \r\n');
      dataRef.push(' \n\n');
      dataRef.push('DateTime Excel Format, Raw sensor data, Zero-offset, Scaling factor,Current,Unit of Current,Temperature, Gain and Potential,rLoad and Internal Zero,Sampling setup\r\n');


      let tempData = '';

      this.logError('-----  ++++++++ ------- ','');
      this.logError('Start writing data in csv format ','');
      this.logError('-----  ++++++++ ------- ','');
      //Start iterating through data Array
      for (let i = 0; i < this.dataForOneDay.length; i++) {

        dataRef.push(
            this.DatabaseService.convertDatetoExcelFormat(this.timezoneOffset,this.dataForOneDay.chartDateArray[i])
            + ',' +
            this.dataForOneDay.dataArray[i]
            + ',' +
            this.currentIArray[i]
            + ',' +
            tempData
            + ',' +
            + '\r\n'
          );
      }

      //create a blob from the array of strings to write to file.

      let blob = new Blob(dataRef, { type: 'text/csv' });
      return this.fileNavigator.writeFile(path,filename,blob,{replace:true})

    })
    .then((succ)=>{
      newLoading.dismiss();
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
          message: `File ready for downloading`,
          duration: 3000,
          position: 'top'
        }).present();
        let subject = 'Data from ' + this.deviceName;
        let body = 'Please find attached all stored sensor data from device ' + this.deviceName;
        this.EmailProvider.sendEmail(this.userEmail,path.concat(filename),subject,body);
      }
    })
    .catch((error)=>{
      this.logError('An error during file download occured ',error);
      newLoading.dismiss();
      this.toast.create({
        message: `File could not created for download`,
        duration: 3000,
        position: 'top'
      }).present();
    });
  }


  //ISO string time.

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
    let hhmmssTime = this.convertDateToYYYYMMDD(date) + '_' + date.getHours() + '_' + mmString + '_' + ssString;

    return hhmmssTime;
	}

  ionviewDidLeave(){
    this.userIsViewingChart = false;
  }

  ionViewWillLeave(){
    this.userIsViewingChart = false;
  }

  logError(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    console.log('ChartsPage: ' + message + ' ' + errStackTrace);
    this.SharedService.saveForLog((new Date().toISOString() + ': ChartsPage: ').concat(message).concat(errStackTrace));
  }

}
