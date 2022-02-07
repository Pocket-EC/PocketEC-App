import { Component,NgZone,ViewChild } from '@angular/core';
import { Platform,NavController, NavParams,ToastController,AlertController } from 'ionic-angular';
import { Network } from '@ionic-native/network';
import { AuthserviceProvider } from '../../providers/authservice/authservice';
import { SharedserviceProvider } from '../../providers/sharedservice/sharedservice';
import { StatusUpdateProvider } from '../../providers/statusupdateservice/statusupdateservice';
import { SignupPage } from '../signup/signup';
import { DatabaseProvider } from '../../providers/database/database';
import { DataReaderService } from '../../providers/datareaderservice/datareaderservice';
import 'rxjs/add/observable/interval';
import { Observable } from 'rxjs/Observable';
import { BackgroundMode } from '@ionic-native/background-mode';
import { Badge } from '@ionic-native/badge';
import { CalibratePage } from '../../pages/calibrate/calibrate';
import { HelpModalPage } from '../help-modal/help-modal';





@Component({
    selector: 'page-home',
    templateUrl: 'home.html'
})
export class HomePage {



  user: user = {
    id: null,
    email: null,
    password: null,
    name: null,
    uniqueToken:null, //sent by server on logging in.
    localDbId: null //set by app on creating local database rowid.
  };
  userId: number; //same as user.localDbId
  device: sensorDevice;
  readLicense: boolean = false;
  loginUser = {
    email: null as string,
    password: null as string
  };

  methodNamesArray = []; // Array<{description: string, databaseRowid: number,dateCreated: string;}>;
  chosenMethodIndex;
  currentMethod: methodParam;
  experimentName: string = 'Exp 1';


  disableButton: boolean=false; // to enable/disable 'Start/Stop Experiment' button
  experimentRunning: boolean = false; //updated by observable from StatusUpdateService.//GUI control. to toggle between 'START/STOP Experiment' button
  showLoadingSpinner = false; //boolean to show device connect/disconnect in progress
  spinnerText: string = ''; //text to accompany loading spinner icon.
  statusUpdateForUser: string;//set by StatusUpdateService subscription  - gives
  exptStartTime: string; //set by StatusUpdateService subscription
  lastSampledTime: string; //set by SharedService subscription
  lastMeasuredConcentration: string;


  forceBadges; //Subscription
  isAuthenticated: boolean = false; //controls gui display.
  displayLiveConcUpdate: boolean = true;

  // Algorithm to be used if multiple steps measured - required for CALIBRATION.
  algorithmArray: Array<algorithm> = [];
  postProcessingParamObj: postProcessingParams = {
                            databaseRowid: null,
                            unitOfCharge: 'mC',
                            offset: 0,
                            sensitivity: 1,
                            unitDependentOnSensitivity:' g/L',
                            algorithm: null,
                            includeFirstMeasure: false
                          }
  @ViewChild('chooseAMethod') chooseAMethodViewChild;
  @ViewChild('unitDependentOnSensitivity') unitDependentOnSensitivityViewChild;
  @ViewChild('algorithmView') algorithmViewChild;
  @ViewChild('unitOfCharge') unitOfChargeViewChild; //to setFocus
  @ViewChild('offset') offsetViewChild;
  @ViewChild('sensitivity') sensitivityViewChild;

  showPostProcessing: boolean = false; //Toggle between show/hide post processing parameters on UI


  constructor(
    private ngZone: NgZone,
    public platform: Platform,
    public navCtrl: NavController,
    public navParams: NavParams,
    public network: Network,
    public toast: ToastController,
    public alert: AlertController,
    public AuthService: AuthserviceProvider,
    public SharedService: SharedserviceProvider,
    public StatusUpdateService: StatusUpdateProvider,
    public DatabaseService: DatabaseProvider,
    public backgroundMode: BackgroundMode,
    private badge: Badge,
    private DataReaderService: DataReaderService
  ) {
      //Check if database is ready and start sampling
    this.platform.ready()
    .then(() => {
      this.DatabaseService.getDatabaseState().first().subscribe(ready => {
        if(ready){
          this.initializePage().then((noErrors)=>{
            this.logError('No errors during initializing: ', noErrors);
          })
          .catch(err=>{
            this.fatalErrorNeedsAttention('Fatal error: Error initializing auth, user, device ',err);
          });
          //subscribe to status updates
          this.statusUpdateSubscriptions();
        }
        else{
          this.fatalErrorNeedsAttention('Fatal error: Local storage database is not ready. Returned false',ready);
        }
      });
      this.backgroundMode.enable();
    }); //end platform ready check.


    //Trigger background sampling when app pushed to background
    this.backgroundMode.on("activate").subscribe(()=>{
      this.logError(' BGM activated at ', new Date().toISOString());
      this.backgroundMode.disableWebViewOptimizations();

      //Trick to keep thread alive in the background.
      this.forceBadges = Observable.timer(1000).subscribe((val)=> {
        this.badge.increase(1);
      });
    },(error)=>{
      this.logError('Background Activate handler threw an error ',error);
    });

    this.backgroundMode.on('enable').subscribe(()=>{
      this.logError( 'Background mode is enabled ', new Date().toISOString());
    },(error)=>{
      this.logError('Background enabled handler threw an error ',error);
    });

    this.backgroundMode.on('deactivate').subscribe(()=>{
      this.logError( 'BGM deactivated ', new Date().toISOString());
      this.forceBadges.unsubscribe();
      this.badge.clear();
    },(error)=>{
      this.logError('  Background deactivate handler threw an error ',error);
    });

    this.backgroundMode.on('failure').subscribe(()=>{
      this.logError( 'Background mode has failed ', new Date().toISOString());
      //disconnect device here?
    },(error)=>{
      this.logError('  Background failed handler threw an error ',error);
    });

    this.backgroundMode.setDefaults(
     {
       title: 'Sampling in progress',
       text: 'PocketEC is working in the background',
       silent: false
     }
    );
  }

  ionViewWillEnter(){
    //Check if already authenticated/signed in
    this.initializePage().then((noErrors)=>{
      this.logError('No errors during initializing: ', noErrors);
    })
    .catch(err=>{
      this.fatalErrorNeedsAttention('Fatal error: Error initializing auth, user, device ',err);
    });
  }





  /**
  * Checks content of user and device parameters and
  * Shows login slide if no user detected in localStorage.
  *
  */

  async initializePage(): Promise<boolean>{
    try {
      this.isAuthenticated = await this.SharedService.getAuth();
      if(this.isAuthenticated == null){
        this.isAuthenticated = false;
        this.device = null;
        this.methodNamesArray = [];
        this.logError('Not authenticated','');
      }
      else{
        this.user = await this.SharedService.getUser();
        if(this.user!=null){
          this.userId = this.user.localDbId;
          this.device = await this.getLastAddedDevice();
          if(this.device != null){
            //Get a list of methods for the experiment
            this.getMethods();

          }
          this.isAuthenticated = true;
        }
      }
      return true;
    }
    catch(err){
      throw err; //handled at calling function.
    }
  }

  /**
  * Called once at startup to start subscription services.
  */
  statusUpdateSubscriptions(){

    this.StatusUpdateService.subscribeToLastMeasuredConcentration().subscribe((data)=>{
      this.ngZone.run(() => {

        this.lastMeasuredConcentration = data;
      });
    });
    this.StatusUpdateService.subscribeToExperimentStatus().subscribe((experimentStatus)=>{
      this.ngZone.run(() => {
        //default value is fault. set in StatusUpdateService
        this.experimentRunning = experimentStatus;
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




  }

  /**
  * set flag for calculating concentration from real time measurements on the fly
  *
  */
  setDisplayLiveConcUpdate(event){
    if(this.currentMethod == null || this.currentMethod == undefined){
      this.SharedService.showToast('A valid method is required for this action','middle');
      return;
    }


    if(this.currentMethod.listOfMeasures == null || this.currentMethod.listOfMeasures == undefined){
      this.SharedService.showToast('Could not find measure steps in chosen method','middle');
      return;
    }
    // this.logError('setting displayLiveConcUpdate= ' + this.displayLiveConcUpdate,'');
    if(event.checked == true){
      this.logError('event.checked is true','');
    }
    if(this.displayLiveConcUpdate == true){
      if(!this.canConcBeDisplayed(this.currentMethod)){
        this.ngZone.run(()=>{
          this.displayLiveConcUpdate = false;
          event.checked = false;
        });
        this.SharedService.showToast('Real time conc. display requires at least one measure step saving data AND one measure step that does not save data');
      }
    }
    this.SharedService.setDisplayLiveConcUpdate(this.displayLiveConcUpdate);
  }
  /**
  * Get a list of methods from database for the user and device chosen.
  */

  getMethods(){
    if(this.userId == null || this.device == null){
      this.logError('user id or device is null. Printing device: ' + this.device,'');
      this.SharedService.showToast('Either a user or the device could not be identified');
      return;
    }
    this.DatabaseService.getListOfMethodNames(this.userId,this.device.deviceId)
    .then(data=>{
      if(data!=null){
        let length = data.length;
        if(length > 0){
          this.methodNamesArray = data;
          if(this.chosenMethodIndex == null){
            this.chosenMethodIndex = 0;
          }
          this.logError('loading method parameters from database','');
          this.getChosenMethod(this.chosenMethodIndex);
        }
        else{
          this.logError('No methods in database ','');
        }
      }
      else{
        this.logError('no methods in database ','');
      }
    })
    .catch(err=>{
      this.logError('Error getting methods for the user',err);
      this.fatalErrorNeedsAttention('An error occured when retrieving a list of methods from the local database',err);
    })
  }

  /*
  *  Selecting a method from ion-select triggers this function call to load the method parameters from the database.
  *
  */

  getChosenMethod(index){

    this.chosenMethodIndex = index;
    this.logError('Print chosen method name ' + JSON.stringify(this.chosenMethodIndex),'');

    return this.DatabaseService.getChosenMethod(this.methodNamesArray[index].databaseRowid)
    .then((method)=>{
      if(method == null || method == undefined){
        //this should not happen
        this.fatalErrorNeedsAttention('The chosen method parameters could not be loaded from the database','null');
      }
      if(method.listOfMeasures == null || method.listOfMeasures == undefined){
        this.logError('Could not find measure steps in the method','');
        this.displayLiveConcUpdate = false;
        return;
      }
      else{
        this.currentMethod = method;
        this.logError('loaded method now ','');
        if(this.canConcBeDisplayed(method)){
          this.displayLiveConcUpdate = true;
        }
        else{
          this.displayLiveConcUpdate = false;
        }
        this.getAlgorithmArray();
        this.logError('Printing retrieved method: ','');
        this.logError(JSON.stringify(this.currentMethod, null, 4),'');
      }
      return;
    })
    .catch(err=>{
      this.logError('Error getting the chosen method details. ',err);
      this.fatalErrorNeedsAttention('An error occured when retrieving method parameters from the local database',err);
    });
  }


  /**
  * Check if real time display of concentration is possible - requires at least one step (measure - not precondition ) where data is not measured
  * @param method <methodParam> with list of measure steps.
  * @return boolean
  */

  canConcBeDisplayed(method:methodParam):boolean{

    //check if there are measure steps
    let length = method.listOfMeasures.length;
    if(length <= 1){
      return false;
    }
    else{
      for(let i=0; i < length ;i++){
        if(method.listOfMeasures[i].save == false){
          return true;
        }
      }
    }
  }


  /**
  *  Validate expt name and method and postProcessingParamObj needed for starting Experiment and call DataReaderService.
  * Imp: Error handling performed by DataReaderService
  */

  async startExperiment(){

    if(this.experimentName == null || this.experimentName == undefined){
      this.SharedService.showToast('Please enter an experiment name before starting an experiment');
      return;
    }

    if(this.chosenMethodIndex == null || this.chosenMethodIndex == undefined){
      if(this.methodNamesArray.length == 0){
        this.SharedService.showToast('Please go into settings to create a method to use for the experiment');
        return;
      }
      else{
        this.SharedService.showToast('Please choose a method to use for the experiment');
        this.chooseAMethodViewChild.open();
        return;
      }
    }

    //happens when user chooses default chosenMethodIndex displayed.
    if(this.currentMethod == null || this.currentMethod == undefined){
      if(this.methodNamesArray.length == 0){
        this.SharedService.showToast('Please go into settings to create a method to use for the experiment');
        return;
      }
      else{
        this.SharedService.showToast('Please choose a method to use for the experiment');
        this.chooseAMethodViewChild.open();
        return;
      }
    }

    if(this.currentMethod.listOfPreconditions == undefined && this.currentMethod.listOfMeasures == undefined ){
      this.SharedService.showToast('Your chosen method does not have any steps saved');
      return;
    }
    if(this.currentMethod.listOfPreconditions == null && this.currentMethod.listOfMeasures == null ){
      this.SharedService.showToast('Your chosen method does not have any steps saved');
      return;
    }
    if(this.currentMethod.listOfPreconditions.length == 0 && this.currentMethod.listOfMeasures.length == 0 ){
      this.SharedService.showToast('Your chosen method does not have any steps saved');
      return;
    }
    //check if all post processing fields required have values.
    if(!this.validateFields()) return;

    if(this.StatusUpdateService.deviceIsBusy){
      this.SharedService.showToast('Device is busy, stop all other processes and try again','middle');
      return;
    }

    this.SharedService.setDisplayLiveConcUpdate(this.displayLiveConcUpdate);

    this.StatusUpdateService.setDeviceIsBusy(true);
    this.StatusUpdateService.setExperimentStatus(true);
    this.StatusUpdateService.setLoadingSpinner(true);
    this.StatusUpdateService.setSpinnerText('Starting experiment..');
    this.StatusUpdateService.setDisableButton(true);
    this.StatusUpdateService.setExptStartTime(new Date().toLocaleString());
    //Error handling performed by DataReaderService
    this.DataReaderService.startExperiment(this.experimentName, this.currentMethod,true, this.postProcessingParamObj);
  }

  /**
  * Trigger stop process in DataReaderService
  **/

  stopExperiment(){
    this.SharedService.setStopExperiment(true);
    this.StatusUpdateService.setExperimentStatus(false);
    this.StatusUpdateService.setLoadingSpinner(true);
    this.StatusUpdateService.setSpinnerText('Stopping experiment..');
    this.StatusUpdateService.setDisableButton(true);
  }

  /**
  *  Get last added device always from localStorage/memory.
  *
  */
  getLastAddedDevice(): Promise<sensorDevice>{
    return this.SharedService.getDevice()
    .then((device) => {
      if(device == null){
        this.logError('Device is null','');
      }
      else{
        this.logError('device is ' + JSON.stringify(device),'');
        this.device = device;
      }
      return device;
    })
    .catch(err=>{
      this.logError('Could not get device from localStorage',err);
      this.fatalErrorNeedsAttention('Error getting saved device from localStorage', err);
    });
  }

  /**
  * Creates algorithm choices for user to use when calculating charge.
  *
  */
  getAlgorithmArray(){
    this.algorithmArray = this.SharedService.createStepCalculationOptions(this.currentMethod);
  }

  /**
  * Checks if required parameters have valid values before calling up the Calibration page.
  *
  */

  async goToCalibrate(){
    try{
      await this.validateBeforeCalibration();
    }
    catch(err){
      this.logError('Error before going to Calibration page',err);
      this.SharedService.showToast(err,'middle');
      return;
    }

    try{
      this.navCtrl.push(CalibratePage, { page: 'home',
                                          index: 1,
                                          listOfMeasures: this.currentMethod.listOfMeasures,
                                          postProcessingParamObj: this.postProcessingParamObj,
                                          algorithm: this.postProcessingParamObj.algorithm,
                                        includeFirstMeasure: this.postProcessingParamObj.includeFirstMeasure });
    }
    catch(err){
      this.logError('Error before going to Calibration page',err);
      this.SharedService.showToast(err,'middle');
    }
  }

  /**
  * Check if all required fields have values for postProcessingParamObj
  * Is called before starting an experiment
  *
  */


  validateFields(){
    if(this.postProcessingParamObj.unitOfCharge == null ||
      this.postProcessingParamObj.unitOfCharge == undefined){
        // validating.dismiss();
        this.SharedService.showToast('Enter a valid value for unit of charge','middle');
        this.unitOfChargeViewChild.setFocus();
        return false;
    }

    if(this.postProcessingParamObj.offset == null ||
      this.postProcessingParamObj.offset == undefined){
        this.SharedService.showToast('Enter a valid value for Offset','middle');
        this.offsetViewChild.setFocus();
        return false;
    }
    if(this.postProcessingParamObj.sensitivity == null ||
      this.postProcessingParamObj.sensitivity == undefined){
        this.SharedService.showToast('Enter a valid value for Sensitivity','middle');
        this.sensitivityViewChild.setFocus();
        return false;
    }
    if(this.postProcessingParamObj.unitDependentOnSensitivity == null ||
      this.postProcessingParamObj.unitDependentOnSensitivity == undefined){
        this.SharedService.showToast('Enter a valid value for Unit','middle');
        this.unitDependentOnSensitivityViewChild.setFocus();
        return false;
    }
    if(this.postProcessingParamObj.algorithm == null ||
      this.postProcessingParamObj.algorithm == undefined){
        this.SharedService.showToast('Enter a valid step for calculating charge','middle');
        if(this.algorithmViewChild != undefined){
          this.algorithmViewChild.open();
        }
        else{
          this.showPostProcessing = true;
          // this.algorithmViewChild.open();
        }
        return false;
    }

    return true;
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
      if(this.postProcessingParamObj.algorithm == null ||
        this.postProcessingParamObj.algorithm == undefined){

          this.SharedService.showToast('Enter a valid algorithm for calculating final charge');
          if(this.algorithmViewChild != undefined){
            this.algorithmViewChild.open();
          }
          else{
            this.showPostProcessing = true;
            // this.algorithmViewChild.open();
          }
          throw Error('Enter a valid algorithm for calculating Charge');
      }
      return;
    }
    catch(err){
      throw err;
    }
  }


  /**
  * User chooses the algorithm to use for calculating final charge.
  * @param index is the index chosen from algorithmArray select object.
  */

  setAlgorithm(index):void{
    let algorithmArrayIndex: number = +index;
    //this.logError('selected ' + algorithmArrayIndex,'');
    this.postProcessingParamObj.algorithm = this.algorithmArray[algorithmArrayIndex];
    //this.logError('Algorithm chosen ' + JSON.stringify(this.postProcessingParamObj.algorithm,null,4),'');
  }

  /**
  * Toggle between post processing view/hide states.
  *
  */
  managePostProcessingView(){
    this.showPostProcessing = !this.showPostProcessing;
  }


    /**
	 * Authenticate a user
	 */

	async login (loginUser){

		//remove status messages from previous errors if any when trying new login
		this.SharedService.setShowFeedback(false);

		//make sure user has entered email and a password
    if(loginUser.email == null){
			this.SharedService.presentAlert("WARNING",'Enter a valid email before clicking the Sign in button!','DISMISS');
			return;
		}
    if(loginUser.password == null){
			this.SharedService.presentAlert("WARNING", 'Enter a valid password before clicking the Sign in button!','DISMISS');
			return;
		}
    if(!this.readLicense){
      this.SharedService.presentAlert("INFO", 'Please agree to Terms and Conditions before signing in','DISMISS');
			return;
    }

		let aPromise = this.AuthService.loginUser(loginUser);
		aPromise.then((object)=>{
      //Check for errors caught in restService
			if(this.SharedService.getShowFeedback()){
				this.SharedService.presentAlert("WARNING",this.SharedService.getFeedbackMessage(),'DISMISS');
			}
			else{
				this.user = object.originalElement;


        this.DatabaseService.saveUserToLocalDatabase(this.user)
        .then((id)=>{
          this.user.localDbId = this.userId = id;
          this.SharedService.setAuth(true);

          this.SharedService.setUser(this.user).then(()=>{
            this.SharedService.getDevice().then((device)=>{
              this.device = device;
              if(this.device != null){
                //Get a list of methods for the experiment
                this.getMethods();

              }

              this.isAuthenticated = true;

            },(e)=>{
              this.SharedService.presentAlert("ERROR",e,"DISMISS",);
            });
          },(e)=>{
            this.SharedService.presentAlert("ERROR",e,"DISMISS",);
          });
        },(e)=>{
          this.SharedService.presentAlert("ERROR",e,"DISMISS",);
        });

		  }
	  },(error) => {
			this.SharedService.presentAlert("ERROR",this.SharedService.getFeedbackMessage(),"DISMISS",);
      this.logError(this.SharedService.getFeedbackMessage(),error);
		});
	}


  /**
  * Push the signup template to the top
  */

  signup () {
		this.navCtrl.push(SignupPage);
  }


    help(){
      this.navCtrl.push(HelpModalPage, { pageTitle: 'Terms And Conditions', index: 'home', stepsArray: null,license: true});
    }



  /**
  * Use a local dummy guest account, no wifi required
  *
  *
  **/

  async guest(){
    if(!this.readLicense){
      this.SharedService.presentAlert("INFO", 'Please agree to Terms and Conditions before proceeding','DISMISS');
			return;
    }
    try{
      let guestUser: user = { name: 'GUEST USER',
                        email: 'GUEST EMAIL',
                        id: 0,
                        password: null,
                        uniqueToken:null,
                        localDbId: null
                      };
      let id = await this.DatabaseService.saveUserToLocalDatabase(guestUser);
      this.user = guestUser;
      this.user.localDbId = this.userId = id;
      this.SharedService.setAuth(true);
      this.SharedService.setUser(this.user);
      this.SharedService.samplingPaused(false); //tell bt-device setup page that sampling is starting.
      this.isAuthenticated = true;
    }
    catch(error){
      this.SharedService.presentAlert('Error',error,'Dismiss');
    }
  }


  //Log error to save and print for debugging.

  logError(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    console.log('HomePage: ' + message + ' ' + errStackTrace);
    this.SharedService.saveForLog((new Date().toISOString() + ': HomePage: ').concat(message).concat(errStackTrace));
  }


  /**
  * Called in unrecoverable cases - sampling will be stopped
  */

  fatalErrorNeedsAttention(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    this.logError(message,error);
    this.SharedService.presentAlert('FATAL Error',message,'DISMISS');
    this.SharedService.saveForLog((new Date().toISOString()).concat(message).concat(errStackTrace));
    this.SharedService.downloadDebugFile(true);
  }
}
