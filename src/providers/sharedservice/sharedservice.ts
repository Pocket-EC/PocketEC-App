import { Injectable } from '@angular/core';
import { ToastController,AlertController } from 'ionic-angular';
import { Storage } from '@ionic/storage';
import { BehaviorSubject } from 'rxjs/Rx'
import { Subject } from 'rxjs/Rx';
import { File } from '@ionic-native/file';
import { EmailProvider } from '../../providers/email/email';
import * as settingsFromFile from "./lmp91000.json";

// import * as settingsFromFile from "./lmp91000_b.json";
// import * as settingsFromFile from "./ADuCM355_v1.json";

/**
* @author vm
*
* This service is used to share the data between the different Controllers
*
*/

@Injectable()
export class SharedserviceProvider {


  showFeedback: Boolean = false;
  showModifyFeedback: Boolean = false;

  user: {
    id: number,
    email: string,
    password: string,
    name: string,
    uniqueToken:string, //sent by server on logging in.
    localDbId: number
  };
  uniqueToken: string;
  userId: number;
  auth = false;
  dataLoaded = false;
  download = false;
  url = "";
  mobileVersion = true; //change this for a mobile build


  stopReconnect: boolean = false;
  displayLiveConcUpdate: boolean = false;


  feedbackTypeModify = "info";
  modifyMessage = "";
  feedbackMessage ="";
  feedbackType = "success";   //The values it understands - info, success, warning
  feedbackTypeBootstrap = "type_info"; //the values it understands - type_info, type_warning, type_error
  mobileDevice = null;

 //Uses angular-local-storage instead of ipcookie
  previousFoods = [];
  device: sensorDevice; //{};
  deviceName: string;
  deviceId: number;

  samplingTime: number;
  pauseSampling: boolean = false;
  currentConfigDetailsFromChartsPage = {
    gain: '350K',
    gainCommand: '28',
    potential: '0.6V',
    potentialCommand:'157'
  }; //object with gain and potential and their commands. See ChartsPage


  dataForLiveConcCalcArray = []; //Holds the array of data required for calc. concentration in real time.

  dataForOneDay: chartData = {
                                dataArray: [],
                                chartDateArray: [],
                                commandArray: [],
                                samplingSetupArray: [],
                                rLoadAndIntZArray: [],
                                zeroOffsetArray: [],
                                scalingFactorArray: [],
                                unitOfCurrentArray: [],
                                length: 0,
                                stepsArray: [],
                                stepsObjectForAnalysis: {
                                                          commandArray: [],
                                                        }
                                };

  deviceSetting = null; //: configJSON;
  defaultConfig = null; //: configJSON; //holds copy of defaultJSON that comes with the app. will never change.
  deviceConfigObj: deviceConfigDBParams = null; //Updated when a new JSON config file is uploaded.
  postProcessingParamObj: postProcessingParams = null;

  //MethodsPage variables.
  listOfPreconditions: Array<techniqueParam> = [];
  preconditionRepetition: number = 1; //default value pulled by methods page
  listOfMeasures: Array<techniqueParam> = [];
  measuresRepetition: number = 1;
  continuousMeasure: boolean;
  public restartFlag: boolean = false;
  method: methodParam;
  public newMethodsSetup$ = new BehaviorSubject(false); //tracks changes made by user to techniques

  samplingPausedStatus;
  samplingServiceStatus;
  deletedData; //user removes all data from phone
  public userDeletedAllData$ = new BehaviorSubject(false); // false as in the beginning sampling is started

  sessionId: string; //communicate new session id created in DatabaseService to HomePage for sending for following data reads from device.
  lastSavedExperimentId: number = null; //dummy default value.
  latestDataForCharts: experimentDataObject = null;
  //{length: number, dataArray: Array<string>, chartDate:Array<string>, commandArray:Array<string>};  //{date:date,time:time,data:data} data from last measured sampling time stored here for charts page.
  public lastSavedExperimentId$ = new BehaviorSubject(this.lastSavedExperimentId); // changing from boolean to sessionid;

  public samplingServiceStatus$ = new BehaviorSubject(false); // false as in the beginning sampling is started
  public samplingSetup$: BehaviorSubject<any>; //Should be the sampling object.
  public samplingTrigger$: BehaviorSubject<boolean>; //Should be the sampling object.

  chartsPageHasNewConfigCommands: boolean = false;
  continuousVoltageFlag: boolean = false;
  newCommands: string = "28 157 3"; //as 350K was requested as default.
  commandFeedback: boolean = true;; //set by homepage for chartspage
  public commandFeedback$ = new BehaviorSubject(this.commandFeedback);

  errorArray = [];
  commsErrorArray: Array<string> = [];
  //Is updated with the timestamp of the last stored dataset
  //set in Database and accessed from Charts/Analysis.
  lastDate;
  userEmail;

  //HomePage variables shared with other components

  stopExperiment: boolean = false;
  stopExperiment$: Subject<boolean>;
  currentExperimentId: number;
  showProcessedReading: boolean = true;

  noOfDataPointsArray: Array<number>;


  constructor(private localStorage: Storage,
              public fileNavigator: File,
              private EmailProvider: EmailProvider,
              private toast: ToastController,
              private alert: AlertController){


    // //initialize device specific data settings from local json file when app loads
    //this.deviceSetting = settingsFromFile;
    // this.logError('Printing deviceSetting: ',JSON.stringify(this.deviceSetting));
    this.defaultConfig = settingsFromFile;


    //update other required property values.

    // this.fileNavigator.readAsText(this.fileNavigator.applicationDirectory + ".", "device.json").then((text)=>{
    //
    // },(error)=>{
    //   this.logError('Could not read device settings file','');
    // });

    //Load uniqueToken.device and userid into memory if status is authenticated

    /* **** default authenticated mode **/
    // let user = {"id":2,"name":"test test","email":"test@test.com","uniqueToken":"test@test.com:1543838129848:1c3c6c9b9fb4265604b12e2bddb959d1"};

    this.getAuth().then(auth=>{
      if(auth){
        this.getUser().then(user=>{
          if(user != null){
            this.user = user; //added 9july18
            this.uniqueToken = user.uniqueToken;
            this.userId = user.localDbId;
            this.userEmail = user.email;
            this.getDeviceSetting().then(()=>{
              if(this.deviceSetting == null || this.deviceSetting == undefined){
                this.saveForLog((new Date().toISOString() + ' ').concat('Could not read device settings from file',''));
                this.presentAlert('Fatal error','Device register parameter options could not be read from the JSON file on the phone','Dismiss');
              }
            },(error)=>{
              this.logError('Error loading device configuration from localStorage',error);
            });
          } //no user in localStorage
        },(error)=>{
          this.logError('Error loading user from localStorage',error);
        });
      }
    },(error)=>{
      this.logError('Error loading Authentication state from localStorage',error);
    });


    //Initialize BehaviorSubject for starting sampling with default value hard coded.
    this.samplingTrigger$ = new  BehaviorSubject(this.pauseSampling);
    this.stopExperiment$ = new Subject();
  }
  /**
  * If deviceSetting not in memory, check localStorage, and if localStorage returns null, use default config from settingsFromFile
  * @return configJSON object
  */

  private async getDeviceSetting(): Promise<configJSON>{
    if(this.deviceSetting == null){
      let deviceSettingAsString = await this.localStorage.get(String(this.userId).concat(':deviceSetting'));
      if(deviceSettingAsString != null && deviceSettingAsString != undefined){
        this.deviceSetting = JSON.parse(deviceSettingAsString);
        await this.getDeviceConfig();
      }
      else{
        this.deviceSetting = settingsFromFile;
        this.setDeviceConfigObj({configId:0,name:'default',dateCreated:'..',config:null});
      }
    }
    if(this.deviceConfigObj == null || this.deviceConfigObj == undefined){
      await this.getDeviceConfig();
    }
    return this.deviceSetting;

  }
  /**
  * Save the current device config database parameters object in memory & localStorage
  * @param deviceConfigDBParams object saved as string.
  *
  */
  setDeviceConfigObj(value:deviceConfigDBParams):void{

    this.deviceConfigObj = value;
    // this.logError('After setting deviceConfigObj in SharedService: ','');
    // this.logError(JSON.stringify(this.deviceConfigObj),'');
    this.localStorage.set(String(this.userId).concat(':deviceConfig'),JSON.stringify(value));
  }

  /**
  * Return database parameters linked to current device config
  *
  *
  */
  async getDeviceConfig():Promise<deviceConfigDBParams>{
    if(this.deviceConfigObj == null){
      let deviceConfigObjAsString = await this.localStorage.get(String(this.userId).concat(':deviceConfig'));
      if(deviceConfigObjAsString != null && deviceConfigObjAsString !=undefined){
        this.deviceConfigObj = JSON.parse(deviceConfigObjAsString);
      }
    }
    // if(this.deviceConfigObj != null){
    //   //this.logError('returning deviceConfigObj from memory: '+ JSON.stringify(this.deviceConfigObj),'');
    // }
    return this.deviceConfigObj;
  }

  /**
  * deviceSetting configJSON object points to new configuration passed as param.
  * @param jsonConfigObject should be an configJSON object.
  *
  */
  setDeviceSetting(jsonConfigObject:configJSON): void{
    //this.logError('this.deviceSetting set with new config: ',jsonConfigObject);
    if(typeof jsonConfigObject === 'object' &&  jsonConfigObject !== null){
      this.deviceSetting = jsonConfigObject;
      this.localStorage.set(String(this.userId).concat(':deviceSetting'),JSON.stringify(jsonConfigObject));
    }
    else{
      throw Error('Configuration is either null or is not an object');
    }

  }

  /**
  * Save in memory the unique database id of the experiment being measured.
  */
  setCurrentExperimentId(experimentId){
    this.currentExperimentId = experimentId;
  }
  /**
  * Return from memory the unique database id of the experiment being measured.
  */
  getCurrentExperimentId(){
    return this.currentExperimentId;
  }

  /**
  * Trigger stop process in subscribers to stopExperiment$ parameter.
  *
  */

  setStopExperiment(stop:boolean){
    this.stopExperiment = stop;
    this.stopExperiment$.next(stop);
  }

  /**
  * Components that should be informed when user clicks on stop, should subscribe to stopExperiment$ here
  *
  */

  subscribeToStopExperiment(){
    return this.stopExperiment$.asObservable();
  }

  setDisplayLiveConcUpdate(value:boolean){
    this.logError('Displaying displayLiveConcUpdate ' + this.displayLiveConcUpdate,'');
    this.displayLiveConcUpdate = value;
  }

  /**
  * Save the postProcessingParamObj in memory for the app and in localStorage
  * @param postProcessingParamObj: postProcessingParams
  */
  setPostProcessingParamObj(object: postProcessingParams){
    this.postProcessingParamObj = object;
    this.localStorage.set(String(this.userId).concat(':postProcObj'),JSON.stringify(object));
  }

  /**
  * Return last saved postProcessingParamsObj from memory.
  * If null, check local storage for last saved value.
  * @return postProcessingParamObj could send null value to calling function.
  */

  async getPostProcessingParamObj(): Promise<postProcessingParams>{
    try{
      if(this.postProcessingParamObj == null || this.postProcessingParamObj == undefined){
        this.postProcessingParamObj = JSON.parse(await this.localStorage.get(String(this.userId).concat(':postProcObj')));
      }
      return this.postProcessingParamObj;
    }
    catch(e){throw e}
  }

  //Log it for bug reports - all components use this.
  saveForLog(log){
    if(this.errorArray.length >= 300){
      this.errorArray.shift();
    }
    this.errorArray.push(log);
  }

  //Log it for bug reports - all components use this.
  saveCommunicationErrors(log){
    this.commsErrorArray.push(log + '\r\n');
  }

  getForLog(){
    return this.errorArray;
  }

  getUserEmail(){
    return this.userEmail;
  }
  //For quick retrival of token from memory without accessing localStorage
  getUniqueToken(){
    return this.uniqueToken;
  }

  //For quick retrival of userid from memory without accessing localStorage
  getUserId(){
    if(this.userId == null || this.userId == undefined){
      this.userId = this.user.localDbId;
    }
    if(this.userId == null || this.userId == undefined){
      throw Error('No valid user Id found');
    }
    else{
      return this.userId;
    }
  }

  /****************************
  **  CHARTS PAGE VARIABLES.
  ***********/

  //DataReaderService notifies Charts with experimentId of step data saved
  setLastSavedExperimentId(experimentId){
    this.lastSavedExperimentId = experimentId;
    this.lastSavedExperimentId$.next(experimentId);
  }


  subscribeToNewExperimentId(){
    return this.lastSavedExperimentId$.asObservable();
  }

  getLastSavedExperimentId(){
    return this.lastSavedExperimentId;
  }

  //called by DatabaseService whenever a batch add of data is performed after sampling time.
  addDataToCharts(value){
    this.latestDataForCharts = value;
  }

  //chart pulls this data whenever notified by homepage after storing measurement from sampling time.
  getLatestDataForCharts(){
    return this.latestDataForCharts;
  }

  setDeletedData(value){
    this.logError('printing deleted value ' + value,'');
    this.deletedData = value;
    this.userDeletedAllData$.next(value);
  }

  renewIfDeletedAllData(){
    return this.userDeletedAllData$.asObservable();
  }

  renewCommandFeedback(){
    return this.commandFeedback$.asObservable();
  }

  setCommandFeedback(value){
    this.commandFeedback = value;
    this.commandFeedback$.next(value);
  }

	getMobileDevice (){
		if(this.mobileVersion){
			return this.mobileDevice;
		}
		else{
			//return ipCookie('mobileDevice');
    }
	}
	setMobileDevice (value){
		this.mobileDevice = value;
		if(!this.mobileVersion){

    }
	}


  getChartsPageHasNewConfigCommands(){
    return this.chartsPageHasNewConfigCommands;
  }

  setChartsPageHasNewConfigCommands(value){
    this.chartsPageHasNewConfigCommands = value;

  }

  setSessionId(value){
    this.sessionId = value;
  }

  getSessionId(){
    return this.sessionId;
  }


  getNewCommandsFromLocalStorage(){
    return this.localStorage.get('currentConfigDetails');
  }

  getCurrentConfigDetailsFromChartsPage(){
    return this.currentConfigDetailsFromChartsPage;
  }


  setContinuousVoltageFlag(value){
    this.continuousVoltageFlag = value;
  }

  getContinuousVoltageFlag(){
    return this.continuousVoltageFlag;
  }

  setSamplingSetup(value){
    this.localStorage.set('samplingSetup',value);
    this.samplingSetup$.next(value);
  }


  public setLastDate(value){
    this.lastDate = value;
  }
  public getLastDate(){
    return this.lastDate;
  }

  public samplingServiceStatusSubscription(){
    return this.samplingServiceStatus$.asObservable();
  }

  public samplingPaused(value){
    this.samplingPausedStatus = value;
    this.samplingServiceStatus$.next(value);
  }

  public renewSamplingTrigger(){
    return this.samplingTrigger$.asObservable();
  }


 /*********************/
 //Bt-Device page

  // setDeviceConfig(value){
  //   this.localStorage.set('deviceConfig',value);
  // }
  //
  // getDeviceConfig(): Promise<any>{
  //   return this.localStorage.get('deviceConfig');
  // }


  async setDevice(value){
    if (value == null){
    //removed from ls
      this.localStorage.remove(String(this.userId).concat("device"));
      this.logError('Removed device from localStorage','');
      return;
    }
    else{
      this.localStorage.set(String(this.userId).concat(':device'),value);
      this.device = value;
      this.deviceId = value.deviceId;
      // this.logError('Device saved to localStorage ' + JSON.stringify(value),'');
    }

  }

  /**
  * Returns local device object. If local device object is null, checks if it exists in localStorage for current user.
  * If device loaded from localStorage, its configuration is loaded from local database.
  * @return device object (sensorDevice)
  */

  async getDevice(): Promise<any>{
    if(this.device != null) {
      this.logError('Device in SharedService is loaded:','');
      return this.device;
    }
    else{
      try{
        this.device = await this.localStorage.get(String(this.userId).concat(':device'));
        if(this.device != null){
          this.logError('Device loaded from localStorage','');
          this.deviceId = this.device.deviceId;
          this.deviceName = this.device.name;
          await this.getDeviceSetting();
        }
        return this.device; //returns null if no device stored in localStorage
      }
      catch(err){
        throw err;
      }
    }
  }

  getDeviceId(): number{
    return this.deviceId;
  }


  // async	getAuth () {
  //   if(this.auth == null){
  //     return await this.localStorage.get('auth');
  //   }
  //   else{
  //     return this.auth;
  //   }
  //
  // }

  getAuth () {
      return this.localStorage.get('auth');
  }

  	setAuth (value){
  		this.auth = value;
      this.localStorage.set('auth',this.auth);
  		// if(!this.mobileVersion){
  		// 	//ipCookie('auth',auth,{'expires': expireDate});
  		// }
  	}
  	async setUser (value){
  		this.user = value;
      if (this.user == null){
      //removed from ls
        this.localStorage.remove("user");
        this.uniqueToken = null;
        this.userId = null;
        this.device = null;
        this.logError('Removed user from localStorage','');
        return;
      }
      else{
        this.localStorage.set("user",this.user);
        this.uniqueToken = this.user.uniqueToken;
        this.userId = this.user.localDbId; //unique local database rowid.
        this.logError('printing user ', JSON.stringify(this.user));
        await this.getDevice(); //this loads device from localStorage if it exists for this user.
      }
  	}

  	async getUser (): Promise<any>{
      if(this.user == null){
        this.user = await this.localStorage.get("user");
        if(this.user == undefined){
          this.user = null;
        }
        else{
          this.logError('User loaded from localstorage: ', this.user);
        }
        this.getDevice(); // will load this.device async if there is anything in localStorage for this user.
      }
      return this.user;
  	}


//NOT USED
  setDeviceName(value){
    this.deviceName = value;
    this.localStorage.set('deviceName',value);
  }

//NOT USED
  getDeviceName(): string{
      return this.deviceName;
  }

  /**
    MethodsPage and HomePage shared variables.

  **/

  savePreconditions(value: Array<techniqueParam>){
    //clone and create a new list
    this.listOfPreconditions = value.map(a => ({...a}));
    this.localStorage.set('listOfPreconditions',this.listOfPreconditions);
  }

  getPreconditions(){
    return this.listOfPreconditions;
  }
  setPreconditionRepetition(value){
    this.preconditionRepetition = value;
    this.localStorage.set('preconditionRepetition',this.preconditionRepetition);
  }

  getPreconditionsRepetition(){
    return this.preconditionRepetition;
  }

  saveMeasures(value: Array<techniqueParam>){
    //clone and create a new list
    this.listOfMeasures = value.map(a => ({...a}));
    this.localStorage.set('listOfMeasures',this.listOfMeasures);
  }

  getMeasures(){
    return this.listOfMeasures;
  }

  setMeasuresRepetition(value){
    this.measuresRepetition = value;
    this.localStorage.set('measuresRepetition',value);
  }

  getMeasuresRepetition(){
    return this.measuresRepetition;
  }

  setContinuousMeasure(value){
    this.continuousMeasure = value;
    this.localStorage.set('continuousMeasure',value);
  }

  getContinuousMeasure(){
    return this.continuousMeasure;
  }



  setMethod(value: methodParam){
    this.method = value;
    this.localStorage.set(String(this.userId).concat(String(this.deviceId)).concat('method'),JSON.stringify(value));
    // this.localStorage.get(String(this.userId).concat(String(this.deviceId)).concat('method')).then((stringifiedData)=>{
    //   // this.logError('Stored in localStorage: ','');
    //   // this.logError(JSON.parse(stringifiedData),'');
    // });
  }

  getLastUsedMethod(): Promise<methodParam>{

    return this.localStorage.get(String(this.userId).concat(String(this.deviceId)).concat('method')).then((stringifiedData)=>{
      this.method = JSON.parse(stringifiedData);
      return this.method;
    });
  }

  //
  // configJSONObjectHasAllProperties(configAsJSON){
  //   try{
  //     let listOfUndefined = [];
  //     this.getListOfUndefinedProperties(configAsJSON,this.defaultConfig,listOfUndefined,[]);
  //     return listOfUndefined;
  //   }
  //   catch(error){
  //     this.logError('Error checking config json object integrity ',error);
  //     throw error;
  //   }
  //
  // }

  /**
  * Takes a new config JSON object and compares it with the required config Object.
  * Makes a list of missing name/values, checks if value is in required format of string or boolean or object.
  * @param newConfig - JSON object to be validated.
  * @param reqdConfigElements - blueprint JSON object that is used for checking newConfig
  * @param listOfUndefined - array that stores missing name/values and names whose values are in incorrect formats.
  * @param propertyParents - array storing parents of the value passed in newConfig (empty array passed the first time)

  */

  getListOfUndefinedProperties(newConfig: configJSON,reqdConfigElements: configJSON,listOfUndefined: Array<string>,propertyParents: Array<string>) {

    for (let [reqdKey,value] of Object.entries(reqdConfigElements)) {
    //  this.logError("Checking for: " + reqdKey,'');
      if(newConfig.hasOwnProperty(reqdKey)){
        if(value != null && value != undefined){
          // if(Array.isArray(value)){
          //   this.logError('value: is an array: ' + reqdKey,'');
          //   for(let k=0;k<value.length;k++){
          //     propertyParents.push(reqdKey);
          //     // this.logError('value: ',value);
          //     // this.logError('newConfig.key: ',newConfig[key]);
          //     this.getListOfUndefinedProperties(newConfig[reqdKey],value,listOfUndefined,propertyParents);
          //   }
          // }
          if(typeof value === 'object'){
            propertyParents.push(reqdKey);
            this.getListOfUndefinedProperties(newConfig[reqdKey],value,listOfUndefined,propertyParents);
            propertyParents.pop();
          }
          else{
            // this.logError('Is not an object','');
            if(typeof value === "string"){
              if(typeof newConfig[reqdKey] !== "string"){
                let propertyPrefix = this.getPropertyPrefix(propertyParents);
                listOfUndefined.push(propertyPrefix.concat(reqdKey) + ': string value reqd');
              }
            }
            if(typeof value === "boolean"){
              if(typeof newConfig[reqdKey] !== "boolean"){
                let propertyPrefix = this.getPropertyPrefix(propertyParents);
                listOfUndefined.push(propertyPrefix.concat(reqdKey) + ': boolean value reqd');
              }
            }
          }
        }
        else{
          this.logError('property is null or undefined','');
          let propertyPrefix = this.getPropertyPrefix(propertyParents);
          listOfUndefined.push(propertyPrefix.concat(reqdKey) + ' is missing a value');
        }
      }
      else{
        let propertyPrefix = this.getPropertyPrefix(propertyParents);
        listOfUndefined.push(propertyPrefix.concat(reqdKey) + ' is missing');
      }
    }
  }

  /**
  * @param string array - takes an array of strings and returns it as .separated concatenation of strings.
  * @return string
  */

  getPropertyPrefix(propertyParents: Array<string>): string{
    let propertyPrefix = '';
    for(let j=0;j<propertyParents.length;j++){
      propertyPrefix = propertyPrefix.concat(propertyParents[j]);
      propertyPrefix = propertyPrefix.concat('.');
    }
    return propertyPrefix;
  }

  /**
  *  Final charge can be calculated from a single step, or combination
  *  of two steps. Create all possible combinations for user to choose from.
  *  Ex: If data collected from two steps, the combinations possbible for
  *  calculating final charge are as follows:
  *  Step 1
  *  Step 2
  *  Step 1 - Step 2
  *  Step 2 - Step 1

  **/

  createStepCalculationOptions(method:methodParam): Array<algorithm>{
    let length = method.listOfMeasures.length;
    let algorithmArray: Array<algorithm> = [];
    let algorithmArrayIndex = 0;
    let option = '';
    let step1;
    let step2;

    for(let i=0; i < length ;i++){
      step1 = method.listOfMeasures[i];
      //Add individual step as options.
      if(step1.save){
        algorithmArray.push({
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
              algorithmArray.push({
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
    return algorithmArray;
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


  createStepsArray(listOfMeasures,algorithm):Array<techniqueParam>{

    let stepsArrayForCalibrations: Array<techniqueParam> = [];
    this.logError('Printing no in list of measures: '+ listOfMeasures.length,'');
    if(listOfMeasures != null && listOfMeasures.length != 0){
      for(let i=0; i< listOfMeasures.length; i++){

        if(listOfMeasures[i].stepNumber == algorithm.step1Index){
          stepsArrayForCalibrations.push(this.createTechniqueClone(listOfMeasures[i]));
          this.logError('Copied to stepsArrayForCalibrations: '+ JSON.stringify(listOfMeasures[i]),'');
          continue;
        }

        if(listOfMeasures[i].stepNumber == algorithm.step2Index){
          stepsArrayForCalibrations.push(this.createTechniqueClone(listOfMeasures[i]));
          this.logError('step2 Copied to stepsArrayForCalibrations: '+ JSON.stringify(listOfMeasures[i]),'');
          continue;
        }
      }
      this.logError('Printing no in stepsArrayForCalibrations: '+ stepsArrayForCalibrations.length,'');
      if(stepsArrayForCalibrations.length == 0){
        throw Error('Cannot proceed with calibration without any calibration steps');
      }
      else{
        return stepsArrayForCalibrations;
      }
    }
    else{
      throw Error('Cannot proceed with calibration without any measure steps');
    }
  }

  /**
  * @param dataBufferArray contains array of bytes in the format: LSB MSB CR
  * @return number
  */

  convertToInteger(dataBufferArray){
    let value = ( dataBufferArray[1] << 8 ) + dataBufferArray[0];
    //this.logError(' value is : ' + value);
    return value;
  }

  setRestartFlag(value){
    this.restartFlag = value;
    this.newMethodsSetup$.next(value);
  }

  subscribeToRestartFlag(){
    return this.newMethodsSetup$.asObservable();
  }

	getUrl (){
		if(this.mobileVersion){
			return this.url;
		}
		else{
			//return ipCookie('url');
    }
	}
	setUrl (value){
		this.url = value;
		if(!this.mobileVersion){
			//ipCookie('url',url,{'expires': expireDate});
    }
	}

  //DataReaderService

  setStopReconnect(value){
    this.stopReconnect = value;
  }

  getStopReconnect(){
    return this.stopReconnect;
  }


/**********************************/
/**********************************/
  /** used by restservice */
/**********************************/
/**********************************/
  setDownload (value){
    this.download = value;
    if(!this.mobileVersion){
      if (this.download == null){
        //ipCookie.remove('this.download');
      }
      else{
        //ipCookie('download',this.download, {'expires': expireDate});
      }
    }
  }

  getDownload (){
    if(this.mobileVersion)
      return this.download;
    else{
      //return ipCookie('download');
    }
  }
  getShowFeedback (){
		if(this.mobileVersion)
			return this.showFeedback;
		else{
			//return ipCookie('showFeedback');
    }
	}
	setShowFeedback (value){
		this.showFeedback = value;
		if(!this.mobileVersion){
			//ipCookie('showFeedback',showFeedback,{'expires': expireDate});
    }
	}
	getShowModifyFeedback (){
		if(this.mobileVersion)
			return this.showModifyFeedback;
		else{
			//return ipCookie('showModifyFeedback');
    }
	}
	setShowModifyFeedback (value){

		this.showModifyFeedback = value;
		if(!this.mobileVersion){
			//ipCookie('showModifyFeedback',showModifyFeedback,{'expires': expireDate});
    }
	}
	getFeedbackTypeBootstrap (){
		if(this.mobileVersion)
			return this.feedbackTypeBootstrap;
		else{
			//return ipCookie('feedbackTypeBootstrap');
    }
	}
	setFeedbackTypeBootstrap (value){
		this.feedbackTypeBootstrap = value;
		if(!this.mobileVersion)	{
      //ipCookie('feedbackTypeBootstrap',feedbackTypeBootstrap,{'expires': expireDate});
    }
	}
	getFeedbackType (){
		if(this.mobileVersion)
			return this.feedbackType;
		else{
			//return ipCookie('feedbackType');
    }
	}
	setFeedbackType (value){
		this.feedbackType = value;
		if(!this.mobileVersion) {
      //ipCookie('feedbackType',feedbackType,{'expires': expireDate});
    }
	}
	getFeedbackTypeModify (){
		if(this.mobileVersion)
			return this.feedbackTypeModify;
		else{
			//return ipCookie('feedbackTypeModify');
		}
	}

	setFeedbackTypeModify (value){
		this.feedbackTypeModify = value;
		if(!this.mobileVersion){
			//ipCookie('feedbackTypeModify',this.feedbackTypeModify, {'expires': expireDate});
		}
	}

  getModifyMessage (){
		if(this.mobileVersion)
			return this.modifyMessage;
		else{
			//return ipCookie('modifyMessage');
		}
	}

	setModifyMessage (value){
		this.modifyMessage = value;
		if(!this.mobileVersion){
			//ipCookie('modifyMessage',this.modifyMessage, {'expires': expireDate});
		}
	}


	getFeedbackMessage (){
		if(this.mobileVersion)
			return this.feedbackMessage;
		else{
			//return ipCookie('this.feedbackMessage');
		}
	}

	setFeedbackMessage (value){
		this.feedbackMessage = value;
		if(!this.mobileVersion){
			//ipCookie('feedbackMessage',this.feedbackMessage, {'expires': expireDate});
		}
	}





  logError(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    console.log('SharedService: ' + JSON.stringify(message, null,4) + ' ' + errStackTrace);
    this.saveForLog((new Date().toISOString() + ': SharedService: ').concat(message).concat(errStackTrace));
  }



  /** Return a copy of method object passed as param.
  * if null passed, create a new object.
  // Is replicated in DataReaderService TODO.

  * @param methodParam object - can be null.
  * @param methodParam
  */
  createNewMethod(method: methodParam): methodParam{
    if(method == null){
      let newMethod = {
        name: 'NONAME',
        dateCreated: null,
        dateModified: null,
        dateModified_localString: null,
        deviceId: this.getDeviceId(),
        listOfPreconditions: [],
        preconditionRepetition: 1,
        listOfMeasures: [],
        measuresRepetition: 1,
        continuousMeasure: true,
        postMeasureSetContinuousVoltage: true,
        unitOfCurrent: 'uA',
        databaseRowid: null,
        userId:this.getUserId()
      };
      return newMethod;
    }
    else{
      let cloneMeasures = [];
      for (let i = 0, len = method.listOfMeasures.length; i < len; i++) {
            cloneMeasures[i] = this.createTechniqueClone(method.listOfMeasures[i],null);
      }
      let clonePreconditions = [];
      for (let i = 0, len = method.listOfPreconditions.length; i < len; i++) {
            clonePreconditions[i] = this.createTechniqueClone(method.listOfPreconditions[i],null);
      }
      let copy = {
        name: method.name,
        dateCreated: method.dateCreated,
        dateModified: method.dateModified,
        dateModified_localString: (new Date(method.dateModified)).toLocaleString(),
        deviceId: method.deviceId,
        listOfPreconditions: clonePreconditions,
        preconditionRepetition: method.preconditionRepetition,
        listOfMeasures: cloneMeasures,
        measuresRepetition: method.measuresRepetition,
        continuousMeasure: method.continuousMeasure,
        postMeasureSetContinuousVoltage: method.postMeasureSetContinuousVoltage,
        unitOfCurrent: method.unitOfCurrent,
        databaseRowid: method.databaseRowid,
        userId:method.userId
      };
      return copy;
    }

  }


  /**
  * Creates a deep copy of the step/technique object of type techniqueParam
  //TODO replicated in DataReaderService
  */

  createTechniqueClone(technique:techniqueParam,clone?: techniqueParam): techniqueParam{
    if(technique == null){
      return <techniqueParam>{};
    }
    if(clone != null){
      clone = { ...technique,
          potential: {...technique.potential,
                      intZ: {...technique.potential.intZ}
                    },
          gain: {...technique.gain,
                    rLoad: {...technique.gain.rLoad}
                }
      };
      return clone;
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
  * @param informUserOfError: boolean. Show a toast that debug file was downloaded and an alert with a message.
  * @param messageForUser: string Optional, send a customised message for alert instead of default message.
  *
  */
  downloadDebugFile(informUserOfError:boolean,messageForUser?:string) {

    let path = this.fileNavigator.externalDataDirectory; //'file:///';
    let today = new Date();
    let filename = this.convertDateForFileName(today);

    let dataArray = this.getForLog();
    let dataLength = dataArray.length;
    let data = [];
    if(dataLength == 0){
     this.showToast('No data to download');
      return;
    }

    data.push('Starting Log \r\n');
    filename = filename + '_DEBUG.csv';
    for(var i=0;i<dataLength;i++){
      data.push(dataArray[i] + '\r\n');
    }
    this.logError('DebugFile:  download to ' + path + ' file ' + filename,'');
    //this.logError('No. of entries in debugfile array ' + data.length,'');

    var blob = new Blob(data, { type: 'text/csv' });
    this.fileNavigator.writeFile(path,filename,blob,{replace:true})
    .then((succ)=>{
      this.logError('Downloaded debug file - no.of lines ' + dataLength,'');

      //show toast
      if(informUserOfError){
        let message = 'An error had occured. A debug file has been created, please check the file for more information.';
        if(messageForUser != null && messageForUser != undefined){
          message = messageForUser;
        }
        this.toast.create({
          message: 'File ' + filename + ' is saved on the phone',
          duration: 10000,
          position: 'top'
        }).present();
      }
      else{
        return this.EmailProvider.sendEmail(this.userEmail,path.concat(filename),'Debug file','The debug file is attached with this message.');
      }
    },(error)=>{
      this.logError('Error saving file to the phone ',error);
      this.toast.create({
        message: 'Error exporting a debug file to the phone',
        duration: 10000,
        position: 'top'
      }).present();
    });
  }

  /**
  * Called to download a record of data points that were not collected due to an error.
  *
  */
  downloadMissingDataHistory() {

    let path = this.fileNavigator.externalDataDirectory; //'file:///';
    let today = new Date();
    let filename = this.convertDateForFileName(today);
    if(this.commsErrorArray.length == 0){
      this.showToast('No data to download');
      return;
    }

    filename = filename + '_err.csv';

    this.logError('Comms. Error File:  download to ' + path + ' file ' + filename,'');


    var blob = new Blob(this.commsErrorArray, { type: 'text/csv' });
    this.fileNavigator.writeFile(path,filename,blob,{replace:true})
    .then((succ)=>{
      this.logError('Downloaded comms err file','');
      this.toast.create({
        message: 'File ' + filename + ' is saved on the phone',
        duration: 10000,
        position: 'top'
      }).present();

      this.EmailProvider.sendEmail(this.userEmail,path.concat(filename),'Missing data list','Missing data timestamp entries');

    },(error)=>{
      this.logError('Error saving file to the phone ',error);
      this.toast.create({
        message: 'Error exporting a missing comms file to the phone',
        duration: 10000,
        position: 'top'
      }).present();
    });
  }

  /**
  * Service called by components to export data
  * @param dataArray array of data to be downloaded
  * @param title.
  * @param filename - for attaching to the email.
  * @param emailSubject  - subject for sending the email
  * @param emailMessage content for body of email.
  */

  downloadFile(dataArray,title,filename,emailSubject,emailMessage){
    let path = this.fileNavigator.externalDataDirectory; //'file:///';
    let dataLength = dataArray.length;
    let data = [];
    if(dataLength == 0) return; //nothing to write

    data.push(title);

    for(var i=0;i<dataLength;i++){
      data.push(dataArray[i] + '\r\n');
    }

    this.logError('File:  download to ' + path + ' file ' + filename,'');
    var blob = new Blob(data, { type: 'text/csv' });
    this.fileNavigator.writeFile(path,filename,blob,{replace:true})
    .then((succ)=>{
      this.logError('Downloaded file - no.of lines ' + dataLength,'');
      this.EmailProvider.sendEmail(this.userEmail,path.concat(filename),emailSubject,emailMessage);
    },(error)=>{
      this.logError('Error saving file to the phone ',error);
      this.toast.create({
        message: 'Error exporting a debug file to the phone',
        duration: 10000,
        position: 'top'
      }).present();
    });
  }


  /**
  ** @param convertDate: Date Can be null-new date will be created.
  *  @return string in format - 'yyyy-mm-dd_HH_MM_SS'
  **/

  convertDateForFileName(convertDate): string{
    let date: Date;
    if (convertDate == null){
      date = new Date();
    }
    else{
      date = new Date(convertDate);
    }

    let mm = date.getMinutes();
    let mmString: string;

    if(mm < 10){
      mmString = '0' + String(mm);
    }
    else{
        mmString = String(mm);
    }

    let ss = date.getSeconds();
    let ssString: string;
    if(ss < 10){
      ssString = '0' + String(ss);
    }
    else {
      ssString = String(ss);
    }

    let utcDate = date.getUTCDate();
    let utcDateString: string;

    if (utcDate < 10) {
        utcDateString = '0' + String(utcDate);
    }
    else{
      utcDateString = String(utcDate);
    }

    let month = date.getUTCMonth() + 1; //January is 0!
    let utcMonthString: string;
    if (month < 10) {
        utcMonthString = '0' + String(month);
    }
    else{
      utcMonthString = String(month);
    }
    let year = date.getUTCFullYear();

    return  year + '-' + utcMonthString + '-' + utcDateString + '_' + date.getHours() + '_' + mmString + '_' + ssString;
  }

  /**
  * call this to show customized alerts
  */
  presentAlert(title,subTitle,buttons) {
    let alert = this.alert.create({
      // title: title,
      subTitle: subTitle,
      buttons: [buttons]
    });
    alert.present();
  }

  /**
  * call this to show customized toast messages
  */
  showToast(message,position?){
    if(position != null || position != undefined){
      this.toast.create({
        message: message,
        position: position,
        showCloseButton: true
      }).present();
    }
    else{
      this.toast.create({
        message: message,
        duration: 3000,
        position: 'top'
      }).present();
    }
  }
}
