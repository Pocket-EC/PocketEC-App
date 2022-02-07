import { Component} from '@angular/core';
import { IonicPage,AlertController } from 'ionic-angular';
import { SharedserviceProvider } from '../../providers/sharedservice/sharedservice';
import { ActionsheetserviceProvider } from '../../providers/actionsheetservice/actionsheetservice';
import { DatabaseProvider } from '../../providers/database/database';



/**
 * Component to choose new app configuration properities or edit/delete old configurations saved to the app.
 * @author VM
 */

@IonicPage()
@Component({
  selector: 'page-upload-json',
  templateUrl: 'upload-json.html',
})
export class UploadJsonPage {


  name: string; //identifier for settingFile.
  configurations = [];
  configuration: deviceConfigDBParams; // {configId,name,dateCreated,config};

  showDeviceSetting: boolean = false;
  showConfigList: boolean = false;
  deviceSettingAsString:string; //string version of JSON formatted jsonConfig object.
  listOfUndefined = [];  //array of strings, stores properties undefined or missing in user entered configuration object.


  constructor(
    public SharedService: SharedserviceProvider,
    public DatabaseService: DatabaseProvider,
    private ActionSheetService: ActionsheetserviceProvider,
    private alertCtrl: AlertController
  ){

  }

  /**
  *  Refresh list of stored configurations from database including the default config installed with the app.
  *  Load the devices' currently linked configuration from app memory. (SharedService)
  */

  ionViewWillEnter(){
    this.loadCurrentConfig();
    this.getListOfConfigurations();
  }

  /**
  * Load the devices' currently linked configuration from app memory. (SharedService)
  * By default, this is shown to the user every time this page opens.
  */

  loadCurrentConfig(){
    this.configuration = this.SharedService.deviceConfigObj;
    this.deviceSettingAsString = JSON.stringify(this.SharedService.deviceSetting,undefined,4);

    if(this.configuration == null){
      this.SharedService.presentAlert('Error','Current configuration of device could not be loaded','DISMISS');
      return;
    }
    if(this.deviceSettingAsString == undefined || this.deviceSettingAsString == null){
      this.SharedService.presentAlert('Error','Current configuration of device cannot be null or undefined','DISMISS');
      return;
    }

    if(this.configuration != null && this.configuration.name != null){
      this.name = this.configuration.name;
    }
    //this.logError('config loaded : ' + JSON.stringify(this.configuration),'');
    this.showDeviceSetting = true;
    this.listOfUndefined = [];
  }

  /**
  * Gets a ordered list of config objects for this user (could  be configs for other devices as well. )
  *  [{name: string, configId: number,dateCreated(as localestring): string}]
  */

  async getListOfConfigurations(): Promise<void>{
    try{
      this.configurations = await this.DatabaseService.getListOfConfigurations(this.SharedService.userId);
    }
    catch(err){
      this.logError('Error getting list of configurations',err);
      this.SharedService.presentAlert('Error',err,'Dismiss');
    }
  }


  /**
  *  Save,Save As, Choose from list of configuration handlers.
  *
  *
  */

  deployActionSheet(){
    this.ActionSheetService.present([
      {
        text: 'Save Changes',
        handler: () => {
          this.updateDeviceConfig();
          this.showConfigList = false;
          this.showDeviceSetting = true;
        }
      },
      {
        text: 'Discard Changes',
        handler: () => {
            this.showConfigList = false;
            this.showDeviceSetting = true;
            this.loadCurrentConfig();

        }
      },
      {
        text: 'Save As New',
        handler: () => {
          this.saveAsNewDeviceConfig();
          this.showConfigList = false;
          this.showDeviceSetting = true;
        }
      },
      {
        text: 'Show Saved List',
        handler: () => {
            this.showConfigList = true;
            this.showDeviceSetting = false;
        }
      },
      {
        text: 'View Current Config',
        handler: () => {
            this.showConfigList = false;
            this.showDeviceSetting = true;
        }
      }

    ]);
  }

  /**
  * Saves user entered JSON object to database, links it to current device
  * and updates app memory
  * JSON object validated and list of missing name/value pairs displayed
  */

  async saveAsNewDeviceConfig(){
    let configurationJSON = null;

    if(this.name == null || this.name.length == 0){
      this.SharedService.presentAlert('Alert','Enter a name for the configuration before saving','Dismiss');
      return;
    }
    if(this.deviceSettingAsString != null && this.deviceSettingAsString.length != 0){
      //check JSON format
      try{
        configurationJSON = JSON.parse(this.deviceSettingAsString);
      }
      catch(error){
          this.logError('Json format error',error);
          this.SharedService.presentAlert('Alert',error,'Dismiss');
          return;
      }
      //check if name/values are missing or if values are in wrong formats.
      try{
        this.listOfUndefined = []; //empty previous list of errors.
        this.SharedService.getListOfUndefinedProperties(configurationJSON,this.SharedService.defaultConfig,this.listOfUndefined,[]);


        if(this.listOfUndefined.length>0){
          this.logError('Printing list of undefined: ','');
          for(let i=0;i<this.listOfUndefined.length;i++){
            this.logError(this.listOfUndefined[i],'');
          }
          this.SharedService.presentAlert('Alert','Missing properties in configuration!' ,'Dismiss');
          return;
        }

        //no undefined properties, proceed to save to database, link to device record and app memory.

        let newConfig = await this.DatabaseService.saveDeviceConfig(this.name,this.deviceSettingAsString,this.SharedService.getUserId(),this.SharedService.getDeviceId());
        await this.DatabaseService.updateDeviceWithNewConfig(this.SharedService.deviceId,newConfig.configId);
        this.configurations.push(newConfig);
        this.configuration = newConfig;
        this.SharedService.setDeviceConfigObj(newConfig);
        this.SharedService.setDeviceSetting(configurationJSON);
        this.SharedService.presentAlert('Alert','New configuration saved!' ,'Dismiss');
      }
      catch(error){
          this.SharedService.presentAlert('Alert','Could not save the configuration details into the local database. Please check debug file for the error log!' ,'Dismiss');
          this.logError('Error saving ',error);
      }
    }
    else{
      this.SharedService.presentAlert('Alert','The textarea is empty','Dismiss');
    }
  }

  /**
  * Update existing config record with user entered JSON object and name.
  * JSON object validated and list of missing name/value pairs displayed before updating database.
  */

  async updateDeviceConfig(){
    let configurationJSON = null;

    if(this.name == null || this.name.length == 0){
      this.SharedService.presentAlert('Alert','Enter a name for the configuration before saving','Dismiss');
      return;
    }
    if(this.deviceSettingAsString == null || this.deviceSettingAsString.length == 0){
      this.SharedService.presentAlert('Alert','The textarea is empty','Dismiss');
      return;
    }

    //check JSON format
    try{
      configurationJSON = JSON.parse(this.deviceSettingAsString);
    }
    catch(error){
        this.logError('Json format error',error);
        this.SharedService.presentAlert('Alert',error,'Dismiss');
        return;
    }
    //check if name/values are missing or if values are in wrong formats.
    try{
      this.listOfUndefined = []; //empty previous list of errors.
      this.SharedService.getListOfUndefinedProperties(configurationJSON,this.SharedService.defaultConfig,this.listOfUndefined,[]);


      if(this.listOfUndefined.length>0){
        this.logError('Printing list of undefined: ','');
        for(let i=0;i<this.listOfUndefined.length;i++){
          this.logError(this.listOfUndefined[i],'');
        }
        this.SharedService.presentAlert('Alert','Missing properties in configuration!' ,'Dismiss');
        return;
      }

      //no undefined properties, proceed to save to database, link to device record and app memory.

      await this.DatabaseService.updateDeviceConfig(this.name,this.deviceSettingAsString,this.configuration.configId);

      this.configuration.name = this.name; //id is the same and dateCreated is the same as before.
      this.configuration.config = configurationJSON;
      this.SharedService.setDeviceConfigObj(this.configuration);
      this.SharedService.setDeviceSetting(configurationJSON);
      this.getListOfConfigurations(); //refresh the list here.
      this.SharedService.presentAlert('Alert','Configuration updated!' ,'Dismiss');
    }
    catch(error){
        this.SharedService.presentAlert('Alert','Could not save the configuration details into the local database. Please check debug file for the error log!' ,'Dismiss');
        this.logError('Error updating config ',error);
    }

  }


  /**
  * Confirm if user needs to delete the chosen config and call delete handler.
  *
  */
  confirmBeforeDeletion(config){
    let confirmAlert = this.alertCtrl.create({
      title: 'WARNING',
      message: 'Delete configuration with name: ' + config.name + ' and date: ' + config.dateCreated + '?',
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
            this.deleteChosenConfig(config);
          }
        }
      ]
    });
    confirmAlert.present();
  }
  /**
  * Delete chosen config record from the local database.
  *
  */
  async deleteChosenConfig(config): Promise<void>{
    try{
      if(config == null){
        throw Error('Config chosen for deletion is null');
      }
      if(config.configId == undefined || config.configId == null){
        throw Error('Config chosen for deletion is null or undefined');
      }
      if(config.configId === this.configuration.configId){
        throw Error('Cannot delete the currently linked configuration');
      }
      if(config.configId == 0){
        throw Error('Cannot delete the default configuration');
      }

      await this.DatabaseService.deleteDeviceConfig(config.configId,this.SharedService.userId);
      let index = this.configurations.indexOf(config);
      if(index > -1){
        this.configurations.splice(index, 1);
      }
      this.SharedService.presentAlert('Alert','Configuration Deleted!' ,'Dismiss');

    }
    catch(err){
      this.logError('error deleting config: ',err);
      this.SharedService.presentAlert('Error',err,'Dismiss');
    }
  }


  /**
  * Loads the chosen configuration from list shown in <div *ngIf=showConfigList>
  *
  */

  chooseConfigFromList(config){
    this.configuration = config;
    this.loadChosenConfiguration();
  }


  /**
  * Uses the config object referenced by global parameter configuration to link current device with a JSON configuration object.
  * The JSON can be either from the local database or the default Config installed with the app from app memory (SharedService)
  *
  */

  async loadChosenConfiguration():Promise<void>{
    try{
      if(this.configuration == null){
        this.SharedService.showToast('Error: Configuration chosen has a null value');
        return;
      }
      if(this.configuration.configId == 0){
        //load the default configuration that came with the app.
        let newConfig = await this.DatabaseService.saveDeviceConfig('default',JSON.stringify(this.SharedService.defaultConfig),this.SharedService.userId,this.SharedService.deviceId);
        await this.DatabaseService.updateDeviceWithNewConfig(this.SharedService.deviceId,newConfig.configId);
        this.SharedService.setDeviceConfigObj(newConfig);
        this.SharedService.setDeviceSetting(this.SharedService.defaultConfig);
        this.configuration = newConfig;
      }
      else{
        //load the referenced config from the database.
        let returnedData = await this.DatabaseService.getSelectedConfiguration(this.configuration.configId);
        if(returnedData.config == null){
          throw Error('Null error');
        }

        if(typeof returnedData.config === 'object'){
          this.SharedService.setDeviceSetting(returnedData.config);
        }
        else{
          this.SharedService.setDeviceSetting(JSON.parse(returnedData.config));
        }

        await this.DatabaseService.updateDeviceWithNewConfig(this.SharedService.deviceId,returnedData.configId);
        this.configuration = returnedData;
        this.SharedService.setDeviceConfigObj(this.configuration);
      }

      this.name = this.configuration.name;
      this.deviceSettingAsString = JSON.stringify(this.SharedService.deviceSetting,undefined,4);

      this.listOfUndefined = []; //clear old list from previous configuration.
      this.showDeviceSetting = true;
      this.showConfigList = false;
      this.SharedService.presentAlert('Alert','Chosen configuration loaded for device!' ,'Dismiss');
      this.logError('Config: ' + this.configuration.name + ' ' + this.configuration.dateCreated + ' linked to device','');

    }
    catch(error){
      this.logError('error loading config: ',error);
      this.SharedService.showToast('Chosen configuration could not be loaded, please check debug log for details');
    }
  }


  logError(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    console.log('UploadJsonPage: ' +message + ' ' +errStackTrace);
    this.SharedService.saveForLog((new Date().toISOString() + ': UploadJsonPage: ').concat(message).concat(errStackTrace));
  }
}
