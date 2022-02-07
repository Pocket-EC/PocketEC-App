import { Component } from '@angular/core';
import { NavController, NavParams, Platform,AlertController} from 'ionic-angular';
import { HelpModalPage } from '../help-modal/help-modal';
import { BtDevicePage} from '../bt-device/bt-device';
import { MethodsPage } from '../methods/methods';
import { UploadJsonPage } from '../upload-json/upload-json';
import { HomePage} from '../home/home';
import { SharedserviceProvider } from '../../providers/sharedservice/sharedservice';
import { StatusUpdateProvider } from '../../providers/statusupdateservice/statusupdateservice';
import { BtSerialProvider } from '../../providers/bt-serial/bt-serial';
import { TabsPage } from '../tabs/tabs';
import { DatabaseProvider } from '../../providers/database/database';
import { EmailProvider } from '../../providers/email/email';





@Component({
  selector: 'page-settings',
  templateUrl: 'settings.html'
})
export class SettingsPage {

  auth: boolean = false;
  //connection & device pairing
  unpairedDevices: any;
  pairedDevices: any;
  connectedDevice: string;
  gettingDevices: boolean;
  paired: boolean = false;
  unpaired: boolean = false;
  showConnectedDevice = false;
  showWhenScanning:boolean = false; //paired

  //debug related.
  showData: Boolean = false; //For displaying locally stored data from bt device
  showExptList: boolean = false; //to view list of experiments to delete
  storedData; //For storing bt device data read from local storage
  storedDataByExperiments; //For storing bt device data read from local storage
  showAllStepsForUser: boolean = false; //show if there is data ins stepsData
  stepsData = []; //for storing steps table data as array

  // Stored device variables.
  storedDevice: sensorDevice;
  configurations = [];
  configuration; // {configId,name,dateCreated,config};
  configurationId: number;



  showDeviceSetting: boolean = false;
  deviceSettingAsString;



  constructor(private platform: Platform,
    public navCtrl: NavController,
    public navParams: NavParams,
    public SharedService: SharedserviceProvider,
    public StatusUpdateService: StatusUpdateProvider,
    public BtSerialService: BtSerialProvider,
    public DatabaseService: DatabaseProvider,
    public EmailProvider: EmailProvider,
    private alertCtrl: AlertController
  ) {

    //Make sure bluetooth is enabled
    this.platform.ready().then(() => {
      this.deviceSettingAsString = JSON.stringify(this.SharedService.deviceSetting,undefined,4);
    },
    (error) => {
      this.logError('Platform not ready for some reason','');
      this.SharedService.presentAlert('Error','Fatal error initializing app','DISMISS');
    });
  }


  //can be after log in, create account or other tab events.

  ionViewCanEnter(){

    this.SharedService.getAuth().then((val) => {

      if(!val){
        this.SharedService.presentAlert('Alert','Please log in to access this page!','DISMISS');
        this.navCtrl.push(TabsPage,{index:"1"});
        return;
      }

      this.auth = true;
      //display connect status
    });
  }

  ionViewWillEnter(){

    this.checkIfDeviceRegistered();
    this.getListOfExperiments();

  }



  showCurrentConfiguration(){
    this.deviceSettingAsString = JSON.stringify(this.SharedService.deviceSetting,undefined,4);
    this.showDeviceSetting = !this.showDeviceSetting;
  }


  // Sets the boolean flags required for the view.

  checkIfDeviceRegistered(): Promise<any>{

    return this.SharedService.getDevice().then((device) => {
      if(device != null) {
        this.logError('device in settings: ' + device,'');
        this.storedDevice = device;
        this.showConnectedDevice = true;
        this.showWhenScanning = false;
      }
      else{
        this.showConnectedDevice = false;
        this.showWhenScanning = false;
      }
    },(error) => {
      this.logError('Error in SharedService localStorage ',error);
    });
  }

  startScanning() {
    this.showWhenScanning = true;
    this.pairedDevices = null;
    this.unpairedDevices = [];
    this.gettingDevices = true;

    this.BtSerialService.fetchUnpairedDevices().then((devices) => {
      this.gettingDevices = false;
      devices.forEach(element => {
          if (element.name != undefined) {
              this.unpairedDevices.push(element); //to display devices with published names alone
          }
      });
      this.unpaired = true;

    },(err) => {
        this.unpaired = false;
        this.logError('Error when listing unpaired devices in Scan: ',err);
    })
    //could have many unrelated paired devices..
    this.fetchPairedDevices();
  }


  fetchPairedDevices(){
    this.BtSerialService.fetchPairedDevices().then((pDevices) => {
      this.pairedDevices = pDevices;

      if(pDevices.length > 0 ){
        this.paired = true;
      }
    },
    (error) => {
      this.paired = false;
      this.logError('Error when listing paired device in scan: ', error);
    });
  }

  //Mode is 0 (new device)  or 1 (saved device already associated with account)

  goToDevicePage(device,mode) {
    if(this.storedDevice == null || this.storedDevice == undefined){
      this.navCtrl.push(BtDevicePage, { device: device, mode: mode });
    }
    else{
      if(this.StatusUpdateService.deviceIsBusy){
        this.SharedService.showToast('Device is busy, stop all processes with current connected device before proceeding!','middle');
        return;
      }
      let modalAlert = this.alertCtrl.create({
    		title: 'WARNING',
    		message: 'Connecting to a new device, proceed?',
    		buttons: [
    			{
    				text: 'Cancel',
    				role: 'cancel',
    				handler: () => {
    					this.logError('Cancel clicked','');
    				}
    			},
    			{
    				text: 'Continue',
    				handler: () => {
              this.navCtrl.push(BtDevicePage, { device: device, mode: mode });
    				}
    			}
    		]
    	});
    	modalAlert.present();
    }

  }

  /**
  * Opens Methods page to add/edit/delete methods to run experiments.
  */
  goToMethodsPage(){
    this.navCtrl.push(MethodsPage);
  }

  /**
  * Opens JSON configuration page to configure app.
  */
  goToUpload(){
    this.navCtrl.push(UploadJsonPage);
  }

  /**
  * Signout user from the app. TODO force app to lose all stored variables.
  *
  */

  signOutNow(){
    this.logError('Logging out ','');
    if(this.StatusUpdateService.deviceIsBusy){
      this.SharedService.showToast('Stop all experiments before trying to log out','middle');
      return;
    }

    setTimeout(()=>{
      this.SharedService.setUser(null);
      
      this.SharedService.setAuth(false);
      this.SharedService.setDevice(null);
      this.navCtrl.setRoot(HomePage);
    },1000);

  }



  manageExptListView(){
    this.showExptList = !this.showExptList;
  }

  //Only used in Test mode - delete data read from device manually.

  deleteStoredDataByExptId(delData){

    this.DatabaseService.deleteExptFromDatabase(delData.experimentId).then(()=>{
      //this.SharedService.setDeletedData(true);
      this.logError('deleted','');
      this.SharedService.showToast('Deleted experiment ' + delData.name + '!');
      this.storedDataByExperiments = this.storedDataByExperiments.filter((data)=>{
        return data.experimentId != delData.experimentId;
      });
    },(error)=>{
      this.logError('Delete data error ' , error);
      this.SharedService.presentAlert('Error','Could not delete data from the local phone storage','DISMISS');
    });

  }

  /**
  * Get a list of user specific experiments.
  * Requires valid globally stored user id
  */


  async getListOfExperiments(){

    try{
      this.storedDataByExperiments = await this.DatabaseService.getListOfExperiments(this.SharedService.userId);
    }
    catch(err){
      this.SharedService.showToast('Could not get a list of experiments for Settings.');
    }
  }


  /**
  * Download buffered log values
  */

  downloadDebugFile() {
    this.SharedService.downloadDebugFile(false);
  }

  downloadMissingDataHistory(){
    this.SharedService.downloadMissingDataHistory();
  }


  /**
  * Display license
  */

  help(){
    this.navCtrl.push(HelpModalPage, { pageTitle: 'Help', index: 2, stepsArray: null,license: true});
  }


  logError(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    console.log('Settings: ' +message + ' ' +errStackTrace);
    this.SharedService.saveForLog((new Date().toISOString() + ': Settings: ').concat(message).concat(errStackTrace));
  }
}
