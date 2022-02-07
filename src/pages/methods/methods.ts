import { Component,NgZone,ViewChild } from '@angular/core';
import { IonicPage, NavController, NavParams,AlertController,LoadingController,ActionSheetController,ToastController } from 'ionic-angular';
import { WheelSelector } from '@ionic-native/wheel-selector';
import { WheelSelectorOptions } from '@ionic-native/wheel-selector';
import { DatabaseProvider } from '../../providers/database/database';
import { SharedserviceProvider } from '../../providers/sharedservice/sharedservice';



/**
 * Generated class for the MethodsPage page.
 *
 * Creates steps for preparing device (preconditioning) and subsequent measurements.
 * Steps are stored in memory in SharedService.
 */


@IonicPage()
@Component({
  selector: 'page-methods',
  templateUrl: 'methods.html',
})
export class MethodsPage {

  showMethodsList: boolean = false;
  showCurrentMethod: boolean = false;
  //GUI wheelSelector parameters
  rLoadWheelSelectorTitle: string;
  gainWheelSelectorOptions: WheelSelectorOptions;
  gainArrayIndex:number = 0;
  potentialArrayIndex: number = 0;
  intZArrayIndex: number = 0;
  rLoadArrayIndex: number = 0;

  /* GUI components display variables - only for html page */
  displayPrecondition: boolean = false;
  displayMeasure: boolean = false;
  displayPostMeasure: boolean = false;
  displayCalib: boolean = false;
  editModeMeasure: boolean = false; //view flag to change fron new technique mode to edit technique Mode
  editModePrecondition: boolean = false;

  deviceId: number; //unique id from database.

  currentTechnique: techniqueParam;
  previousCurrentTechnique: techniqueParam;
  currentMethod: methodParam;
  listOfMethods: Array<methodParam> = [];
  chosenMethod: methodParam; //view object.

  // Algorithm to be used if multiple steps measured - required for CALIBRATION.
  algorithmArray: Array<algorithm> = [];
  algorithm: algorithm;
  includeFirstMeasure: boolean = false;
  stepsObjectForAnalysis: stepsObject = {
                            unitOfCharge: 'mC',
                            offset: 0,
                            sensitivity: 1,
                            unitDependentOnSensitivity:' g/L'
                          }
  @ViewChild('unitDependentOnSensitivity') unitDependentOnSensitivityViewChild;
  @ViewChild('algorithmView') algorithmViewChild;

  restartFlag: boolean = false;
  restartFlag$; // observable

  constructor(public navCtrl: NavController,
    public navParams: NavParams,
    private ngZone: NgZone,
    private alert: AlertController,
    private loadingCtrl: LoadingController,
    private toast: ToastController,
    private actionSheetCtrl: ActionSheetController,
    private wheelSelector: WheelSelector,
    public DatabaseService: DatabaseProvider,
    public SharedService: SharedserviceProvider
  ) {


    if(this.SharedService.deviceSetting == null || this.SharedService.deviceSetting == undefined){
      this.SharedService.presentAlert('Missing parameters','Device specific resistor parameters have not been set','Dismiss');
      //TODO fatal error - cannot proceed further.
    }

    //load last used method from localStorage, no need to lookup database.
    this.SharedService.getLastUsedMethod()
    .then((method)=>{
      if(method != null || method != undefined){
        // Method copied from localStorage!
        this.currentMethod = this.SharedService.createNewMethod(method);
      }
      else{ //Occurs the first time or when all methods are deleted by the user.
        this.currentMethod = this.SharedService.createNewMethod(null);
        this.saveMethod();//save to database
      }
      if(this.currentMethod != null && this.currentMethod != undefined){
        this.showCurrentMethod = true;
      }
      this.setDefaultValues();
    })
    .catch((error)=>{
      this.logError('Error loading last used method from localStorage',error);
    });

    this.getListOfMethods();

  }

  /**
  * Load all saved methods from database into listOfMethods
  * async (not needed immediately after loading page. )
  *
  */
  getListOfMethods(): void{
    this.DatabaseService.getMethods(this.SharedService.userId,this.SharedService.deviceId)
    .then(methods=>{
      this.listOfMethods = methods;
      this.logError('Refreshed listOfMethods from database: ' + methods.length,'');
    })
    .catch((error)=>{
      this.logError('Error getting methods from database ',error);
      this.SharedService.presentAlert('Error','Error retrieving stored methods','DISMISS');
    });
  }

  /**
  * Saves currentTechnique object either as new precondition or measure step.
  * @param isMeasureStep: boolean IF true - save as measurement technique
    false -  Save as precondition technique
  */

  async addNewTechnique(isMeasureStep:boolean){

    let newLoading = this.loadingCtrl.create({
      content: 'Adding..'
    });
    return await newLoading.present()
    .then(async ()=>{
      // this.logError('***********+ADDING NEW Technique   *************','');

      let newTechnique = this.createTechniqueClone(this.currentTechnique);
      if(!newTechnique.save){
        newTechnique.dataFrequency = null;
        newTechnique.zeroOffset = null;
        newTechnique.scalingFactor = null;
      }

      newTechnique.methodId = this.currentMethod.databaseRowid;
      // this.logError('Before saving ' +  JSON.stringify(this.currentTechnique,undefined,2),'');
      //let updateNumberOfSteps;
      try{
        if(isMeasureStep){
          // updateNumberOfSteps = this.currentMethod.listOfMeasures.length + 1;
          // await this.DatabaseService.saveStep(newTechnique,isMeasureStep,updateNumberOfSteps);
          this.currentMethod.listOfMeasures.push(newTechnique);
          //this.SharedService.saveMeasures(this.currentMethod.listOfMeasures);
        }
        else{
          // updateNumberOfSteps = this.currentMethod.listOfPreconditions.length + 1;
          // await this.DatabaseService.saveStep(newTechnique,isMeasureStep,updateNumberOfSteps);
          this.currentMethod.listOfPreconditions.push(newTechnique);
          // this.SharedService.savePreconditions(this.currentMethod.listOfPreconditions);
        }

        newTechnique.color = 'black';
        //store the changes in appmemory and localstorage.
        this.SharedService.setMethod(this.SharedService.createNewMethod(this.currentMethod));

      }
      catch(error){
        this.logError('saving step to database error',error);
        this.SharedService.downloadDebugFile(true,'Step could not be saved');
      }
    })
    .then(()=>{
      this.logError('Step/technique saved!','');
      newLoading.dismiss();
      // this.restartFlag = true;
      // this.SharedService.setRestartFlag(true);
    });
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
  * Common method for both preconditions and measures
  * Passes reference of user chosen step/technique to global currentTechnique object for editing.
  */

  editTechnique(technique: techniqueParam,isMeasureStep:boolean){

    if(this.currentTechnique != null || this.currentTechnique != undefined)  this.currentTechnique.color = 'black';
    if(isMeasureStep){
      this.editModeMeasure = true;
      if(this.editModePrecondition) this.editModePrecondition = false; // reset precondition edit mode
    }
    else{
      this.editModePrecondition = true;
      if(this.editModeMeasure) this.editModeMeasure = false; // reset measure edit
    }
    technique.color = 'danger'; //step in red to denote step being edited

    this.previousCurrentTechnique = this.createTechniqueClone(this.currentTechnique); //save the old object values for later.
    this.currentTechnique = technique;
    this.logError('save parameter ', technique.save);
    if(!technique.save){ //reset null values to previous values.
      this.currentTechnique.dataFrequency = this.previousCurrentTechnique.dataFrequency;
      this.currentTechnique.zeroOffset = this.previousCurrentTechnique.zeroOffset;
      this.currentTechnique.scalingFactor = this.previousCurrentTechnique.scalingFactor;
    }


    //Load the indices for the rload,intz,gain & potential wheelSelector
    this.intZArrayIndex = technique.potential.intZ.index;
    this.rLoadArrayIndex = technique.gain.rLoad.index;
    this.gainArrayIndex = technique.gain.index;
    this.potentialArrayIndex = technique.potential.index;

    this.logError('******* EDITING Technique   **********','');
    console.log(JSON.stringify(this.currentTechnique,undefined,2));
    this.logError('','');
  }

  /**
  * Common method for both preconditions and measures
  * @param  isMeasureStep: boolean true - measure step - false - preconditions
  */

  saveTechnique(isMeasureStep:boolean){
    let newLoading = this.loadingCtrl.create({
      content: 'Saving..'
    });
    return newLoading.present()
    .then(()=>{
      if(this.currentTechnique.save){
        if(this.currentTechnique.dataFrequency == null ||
            this.currentTechnique.dataFrequency == 0 ||
            this.currentTechnique.dataFrequency == undefined){
            this.SharedService.presentAlert('Warning','Enter a valid Data frequency for the step','Dismiss');
            return;
        }
        if(this.currentTechnique.zeroOffset == null ||
          this.currentTechnique.zeroOffset == undefined){
          this.SharedService.presentAlert('Warning','Enter a valid Zero Offset for the step','Dismiss');
          return;
        }
        if(this.currentTechnique.scalingFactor == null ||
          this.currentTechnique.scalingFactor == undefined){
          this.SharedService.presentAlert('Warning','Enter a valid Scaling Factor for the step','Dismiss');
          return;
        }
      }
      else{
        this.currentTechnique.dataFrequency = null;
        this.currentTechnique.zeroOffset = null;
        this.currentTechnique.scalingFactor = null;
      }

      if(this.currentTechnique.duration == null ||
        this.currentTechnique.duration == undefined ||
        this.currentTechnique.duration == 0 ||
        this.currentTechnique.duration < 0){
        this.SharedService.presentAlert('Warning','Enter a valid Duration for the step','Dismiss');
        return;
      }
      if(this.currentMethod.unitOfCurrent == null ||
        this.currentMethod.unitOfCurrent == undefined ||
        this.currentMethod.unitOfCurrent.length == 0){
        this.SharedService.presentAlert('Warning','Enter a valid Unit of Current for the step','Dismiss');
        return;
      }

      this.currentTechnique.color ='black';

      if(isMeasureStep){
        this.editModeMeasure = false;
      }
      else{
        this.editModePrecondition = false;
      }

      this.logError('Updated step: ' + JSON.stringify(this.currentTechnique,undefined,2),'');
      //reuse the previousCurrentTechnique object to uncouple from saved step.
      this.currentTechnique = this.createTechniqueClone(this.currentTechnique,this.previousCurrentTechnique);

    })
    .then(()=>{
      this.logError('Dismissed','');
      newLoading.dismiss();
    });
  }


  removePrecondition(precondition,index){
    if(this.editModePrecondition){
      if(this.currentTechnique === precondition){
        this.editModePrecondition = false;
      }
    }
    try{
      this.currentMethod.listOfPreconditions.splice(index,1);
    }
    catch(err){
      this.logError('Precondition step could not be deleted. ',err);
      this.SharedService.downloadDebugFile(true,'Step object could not be deleted from the database');
    }
  }

  removeMeasure(measure,index){
    if(this.editModeMeasure){
      if(this.currentTechnique === measure){
        this.editModeMeasure = false;
      }
    }
    this.currentMethod.listOfMeasures.splice(index,1);
  }



  /**
  * Global object currentMethod is saved as new entry in database or updated if it exists already in database.
  *
  */

  async saveMethod(){
    if(this.currentMethod.name == null || this.currentMethod.name == undefined || this.currentMethod.name.length == 0){
      this.toast.create({
        message: `Enter a method name before saving the method`,
        duration: 3000,
        position: 'top'
      }).present();
      return;
    }
    if(!this.currentMethod.continuousMeasure){
      if(this.currentMethod.measuresRepetition == null || this.currentMethod.measuresRepetition == undefined){
        this.toast.create({
          message: `Enter a measures repetition number or choose continuous measurement`,
          duration: 3000,
          position: 'top'
        }).present();
        return;
      }
    }
    let saving = this.loadingCtrl.create({
      content: 'Saving..'
    });
    return saving.present()
    .then(()=>{
      this.showCurrentMethod = true;
      this.showMethodsList = false;
      if(this.currentMethod.databaseRowid != null){
        this.logError('method already exists in database. update it  ','');
        this.ngZone.run(()=>{
          this.listOfMethods = this.listOfMethods.filter((data)=>{
            return data.databaseRowid != this.currentMethod.databaseRowid;
          });
        });

        this.logError('Removed it from the list: ' + this.listOfMethods.length,'');
        return this.DatabaseService.updateMethod(this.currentMethod)
        .then((method)=>{

          this.listOfMethods.push(method);
          this.logError('Updated! Add to the list: ' + this.listOfMethods.length,'');
          this.SharedService.setMethod(this.currentMethod);
        })
        .catch(error=>{
          this.logError('error from database updateMethod: ', error);
          this.SharedService.downloadDebugFile(true,'Method could not be updated and saved');
        });
      }
      else{ //if new method was created..
        return this.DatabaseService.saveMethod(this.currentMethod)
        .then((method)=>{
          this.currentMethod = method;
          // this.logError('Method saved!','');
          this.listOfMethods.push(method);
          this.SharedService.setMethod(this.SharedService.createNewMethod(method)); //will store this into localStorage as well as making a copy available for DataReaderService
          //create steps for calibration?
        })
        .catch((error)=>{
          this.logError('Error saving method to the database',error);
          this.SharedService.downloadDebugFile(true,'Method could not be saved to the local database');
        });
      }
    })
    .then(()=>{
      this.logError('Method saved/updated','');
      saving.dismiss();
      // this.restartFlag = true;
      // this.SharedService.setRestartFlag(true);
    });
  }

  /**
  *  Global object currentMethod is saved as a new entry in the database.
  *
  */

  async saveAsNewMethod(){
    if(this.currentMethod.name == null || this.currentMethod.name == undefined || this.currentMethod.name.length == 0){
      this.toast.create({
        message: `Enter a method name before saving the method`,
        duration: 3000,
        position: 'top'
      }).present();
      return;
    }
    let saving = this.loadingCtrl.create({
      content: 'Saving as new method..'
    });
    return saving.present()
    .then(()=>{
      this.showCurrentMethod = true;
      this.showMethodsList = false;
      this.currentMethod.databaseRowid = null;
      this.currentMethod.dateCreated = null;

      return this.DatabaseService.saveMethod(this.currentMethod)
      .then((method)=>{
        this.currentMethod = method; //not necessary, but here to show that currentmethod is updated with databaserowids
        this.logError('Printing newMethod: **********',method);
        this.listOfMethods.push(method);
        this.SharedService.setMethod(method); //will store this into localStorage as well as make it available for DataReaderService
      })
      .catch((error)=>{
        this.logError('Error saving method to the database',error);
        this.SharedService.downloadDebugFile(true,'Method could not be saved to the local database');
      });
    })
    .then(()=>{
      saving.dismiss();
      // this.restartFlag = true;
      // this.SharedService.setRestartFlag(true);
    });
  }



  /**
  * If user changes to a new method in the middle of making changes to currentMethod
  * confirm that they really want to do this before changing it.
  */
  confirmBeforeLoadingChosenMethod(method): void{

    this.logError('Loading method: ', method.databaseRowid);
    //go to the view directly, do not load it again if user chose the method currently being edited.
    if(this.currentMethod.databaseRowid == method.databaseRowid){
      this.showCurrentMethod = true;
      this.showMethodsList = false;
      return;
    }
    let confirmAlert = this.alert.create({
      title: 'WARNING',
      message: 'Discard changes to ' + this.currentMethod.name + ' and load method ' + method.name + '?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            this.logError('Do not load!','');
          }
        },
        {
          text: 'Continue',
          handler: () => {
            this.loadChosenMethod(method);
          }
        }
      ]
    });
    confirmAlert.present();


  }
  /**
  * Point current method reference to the chosen methodParam object.
  * @param method: methodParam
  *
  */

  loadChosenMethod(method): void{
    this.currentMethod = method;
    this.showCurrentMethod = true;
    this.showMethodsList = false;
  }

  /**
  * To discard user made changes, discard old currentMethod object and get the methodParam object from the database.
  * Point the index in the listOfMethods array to new object
  * If currentMethod points to method loaded from localStorage, compare databaseRowid to methods in list and
  * point to the method in the list (this will be the original if savemethod is not called on currentMethod).
  */

  async discardChanges(): Promise<void>{
    try{
      if(this.currentMethod.databaseRowid == null || this.currentMethod.databaseRowid == undefined){
        throw Error('Method identifier cannot be null');
      }
      let index = this.listOfMethods.indexOf(this.currentMethod);
      if(index > -1){
        this.currentMethod = await this.DatabaseService.getChosenMethod(this.currentMethod.databaseRowid);
        this.listOfMethods[index] = this.currentMethod;
      }
      else{
        this.logError('Method would have been loaded from local storage.Find id in array ','');
        for(let i=0;i<this.listOfMethods.length; i++){
          if(this.currentMethod.databaseRowid === this.listOfMethods[i].databaseRowid){
            this.currentMethod = this.listOfMethods[i];
            break;
          }
        }
      }
    }
    catch(err){
      this.logError('Method could not be refreshed from the database',err);
      this.SharedService.presentAlert('Error',err,'Dismiss');
    }
  }

  /**
  *  Opens a wheelSelector for user to choose loadResistor and internalZero values for setting gain & potential
  *  On choosing loadResistor and internalZero, another wheelSelector opens for user to set gain and potential parameters.
  *
  */

  setRLoadandIntZ(){
    this.wheelSelector.show({
      title: 'Select Resistor Load and Internal Zero',
      positiveButtonText: 'Choose',
      negativeButtonText: 'Cancel',
      items: [
        this.SharedService.deviceSetting.TIACN,
        this.SharedService.deviceSetting.REFCN
      ],
      defaultItems: [
        { index:0, value: this.SharedService.deviceSetting.TIACN[this.rLoadArrayIndex].description},
        { index:1, value: this.SharedService.deviceSetting.REFCN[this.intZArrayIndex].description}
      ]
    }).then(result =>{
      this.rLoadArrayIndex = this.currentTechnique.gain.rLoad.index = result[0].index;
      this.currentTechnique.gain.rLoad.description = this.SharedService.deviceSetting.TIACN[this.rLoadArrayIndex].description;
      this.intZArrayIndex = this.currentTechnique.potential.intZ.index = result[1].index;
      this.currentTechnique.potential.intZ.description = this.SharedService.deviceSetting.REFCN[this.intZArrayIndex].description;
      this.currentTechnique.rLoadWheelSelectorTitle = 'Set Gain at ' +
            this.currentTechnique.gain.rLoad.description + ', Potential at ' + this.currentTechnique.potential.intZ.description;

      this.openGainAndPotential();

    },(error)=>{
      this.logError('User cancelled Change intZ/rLoad ' ,error);
    });
  }


  openGainAndPotential(){
    // this.logError('rload and internal zero is ' + this.SharedService.deviceSetting.TIACN[this.currentTechnique.gain.rLoad.index].description + ' and ' + this.SharedService.deviceSetting.REFCN[this.currentTechnique.potential.intZ.index].description,'');
    // this.logError('gain array index should be set to ' + this.gainArrayIndex,'');
    // this.logError('potential array index should be set to ' + this.potentialArrayIndex,'');
    // this.logError('default values ' + this.SharedService.deviceSetting.TIACN[this.rLoadArrayIndex].SETTING[this.gainArrayIndex].description + '   '+
    // this.SharedService.deviceSetting.REFCN[this.intZArrayIndex].SETTING[this.potentialArrayIndex].description,'');




    this.wheelSelector.show({
      title: this.currentTechnique.rLoadWheelSelectorTitle,
      positiveButtonText: 'Choose',
      negativeButtonText: 'Cancel',
      items: [
        this.SharedService.deviceSetting.TIACN[this.rLoadArrayIndex].SETTING,
        this.SharedService.deviceSetting.REFCN[this.intZArrayIndex].SETTING
      ],
      defaultItems: [
        { index:0, value: this.SharedService.deviceSetting.TIACN[this.rLoadArrayIndex].SETTING[this.gainArrayIndex].description },
        { index:1, value: this.SharedService.deviceSetting.REFCN[this.intZArrayIndex].SETTING[this.potentialArrayIndex].description }
      ]

    }).then(result =>{
      this.gainArrayIndex = result[0].index;
      this.potentialArrayIndex = result[1].index;
      this.currentTechnique.gain.command = Number(this.SharedService.deviceSetting.TIACN[this.rLoadArrayIndex].SETTING[this.gainArrayIndex].command);
      this.currentTechnique.potential.command = Number(this.SharedService.deviceSetting.REFCN[this.intZArrayIndex].SETTING[this.potentialArrayIndex].command);
      this.currentTechnique.gain.description = this.SharedService.deviceSetting.TIACN[this.rLoadArrayIndex].SETTING[this.gainArrayIndex].description;
      this.currentTechnique.potential.description = this.SharedService.deviceSetting.REFCN[this.intZArrayIndex].SETTING[this.potentialArrayIndex].description;

    },(error)=>{
      this.logError('User cancelled Change gain/potential ',error);
    });
  }

  public savePreconditionRepetition(){
    if(this.currentMethod.preconditionRepetition == null || this.currentMethod.preconditionRepetition == undefined){
      this.currentMethod.preconditionRepetition = 1;
    }
    this.logError('Printing precondition repetion ', this.currentMethod.preconditionRepetition);
    this.SharedService.setPreconditionRepetition(this.currentMethod.preconditionRepetition);
    // this.restartFlag = true;
    // this.SharedService.setRestartFlag(true);
  }

  public saveMeasureRepetition(){
    if(this.currentMethod.measuresRepetition == null || this.currentMethod.measuresRepetition == undefined){
      this.currentMethod.measuresRepetition = 1;

    }
    this.SharedService.setMeasuresRepetition(this.currentMethod.measuresRepetition);
    // this.restartFlag = true;
    // this.SharedService.setRestartFlag(true);
  }

  toggleVoltageSetting(voltageFlag){
    this.currentMethod.postMeasureSetContinuousVoltage = voltageFlag;
    this.SharedService.setContinuousVoltageFlag(voltageFlag);
    // this.restartFlag = true;
    // this.SharedService.setRestartFlag(true);
  }

  toggleContinuousMeasurement(continuousMeasure){
    this.SharedService.setContinuousMeasure(continuousMeasure);
    // this.restartFlag = true;
    // this.SharedService.setRestartFlag(true);
  }

  restartMeasurement(){
    // this.navCtrl.push(TabsPage,{index:"1" , restart: true});
    //this.navCtrl.setRoot(HomePage); TODO is resetting all the variables in homepage!!
    this.SharedService.presentAlert('Restart measurement','Go to Home to restart measurements to use new settings','Dismiss');

  }


  /**
  *  Default values set for all ngModel properties of techniqueParam.
  *
  */
  setDefaultValues():void{
    if(this.currentTechnique !=null) return;
    //this.logError('setDefaultValues: currentTechnique is null ','');
    //SETTING DEFAULTS as first value in arrays.
    this.currentTechnique = {
          potential: {
            description: this.SharedService.deviceSetting.REFCN[0].SETTING[0].description,
            command: Number(this.SharedService.deviceSetting.REFCN[0].SETTING[0].command),
            index: 0,
            intZ: {
              description: this.SharedService.deviceSetting.REFCN[0].description,
              index: 0
            }
          },
          gain: {
            description: this.SharedService.deviceSetting.TIACN[0].SETTING[0].description,
            command: Number(this.SharedService.deviceSetting.TIACN[0].SETTING[0].command),
            index: 0,
            rLoad: {
                    description: this.SharedService.deviceSetting.TIACN[0].description,
                    index: 0
                  }
          },
          duration: 3,
          save: false,
          dataFrequency: 200,
          color: 'black',
          rLoadWheelSelectorTitle:'Set Gain @10Ω & Potential @20%', //depends on choie of intZ and rLoad
          scalingFactor: 1,
          zeroOffset: 0,
          databaseRowid: null,
          methodId: null,
          unitOfCurrent: 'uA',
          stepNumber: null
        };
    this.gainWheelSelectorOptions = {
      title: this.rLoadWheelSelectorTitle,
      positiveButtonText: 'Choose',
      negativeButtonText: 'Cancel',
      items: [
        this.SharedService.deviceSetting.TIACN[0].SETTING,
        this.SharedService.deviceSetting.REFCN[0].SETTING

      ],
      defaultItems: [
        { index:0, value: this.SharedService.deviceSetting.TIACN[0].SETTING[0].description},
        { index:0, value: this.SharedService.deviceSetting.REFCN[0].SETTING[0].description}//,

      ]
    };
  }

  /**
  * Create a new methodParam object
  *
  */
  createNew(): void{
    this.logError('create clicked','');
    this.currentMethod = this.SharedService.createNewMethod(null);
    this.saveMethod();
  }

  //Methods action menu.

  deployActionSheet(){
    const actionSheet = this.actionSheetCtrl.create({
      title: 'Methods Menu',
      cssClass: 'basicActionSheet',
      buttons: [
        {
          text: 'Save As',
          handler: () => {
            this.logError('Save as clicked','');
            this.showCurrentMethod = true;
            this.showMethodsList = false;
            this.saveAsNewMethod();
          }
        },{
          text: 'Discard Changes',
          handler: () => {
            this.logError('Discard Changes','');
            this.showCurrentMethod = true;
            this.showMethodsList = false;
            this.discardChanges();
          }
        },{
          text: 'New Method',
          role: 'create',
          handler: () => {
            this.showCurrentMethod = true;
            this.showMethodsList = false;
            this.createNew();
          }
        },{
          text: 'Show Saved Methods',
          role: 'list',
          handler: () => {
            this.logError('Viewing list of methods','');
            this.showMethodsList = true;
            this.showCurrentMethod = false;
          }
        },
        {
          text: 'View Current method',
          role: 'view',
          handler: () => {
            this.logError('View Current method ','');
            this.goToMethodEdit();
          }
        },{

          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            this.logError('Cancel clicked','');
          }
        }
      ]
    });
    actionSheet.present();
  }

  /**
  * Go to the method editing view
  *
  */

  goToMethodEdit(){
    this.showMethodsList = false;
    this.showCurrentMethod = true;
  }

  /**
  * Confirm if user needs to delete the chosen method and then call delete handler.
  *
  */
  confirmBeforeDeletion(method:methodParam){
    let confirmAlert = this.alert.create({
      title: 'WARNING',
      message: 'Delete method: ' + method.name + ' last modified on: ' + method.dateModified_localString + '?',
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
            this.deleteChosenMethod(method);
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

  async deleteChosenMethod(method:methodParam): Promise<void>{
    try{
      if(method.databaseRowid == null || method.databaseRowid == undefined){
        throw Error('Unique identifier missing in Method');
      }
      if(this.currentMethod === method){
        throw Error('Method currently being edited cannot be deleted');
      }
      if(this.currentMethod.databaseRowid === method.databaseRowid){
        throw Error('Method being edited cannot be deleted');
      }
      await this.DatabaseService.deleteMethod(method.databaseRowid);
      this.logError('Deleted method with id: ' + method.databaseRowid +' from the database','');
      let index = this.listOfMethods.indexOf(method);
      if(index > -1){
        this.listOfMethods.splice(index, 1);
      }
      else{
        throw Error('Method could not be found in the list!');
      }
      this.SharedService.showToast('Method ' + method.name + ' deleted');
    }
    catch(err){
      this.logError('error deleting method: ',err);
      this.SharedService.presentAlert('Error',err,'Dismiss');
    }
  }

  //Log error to save and print for debugging.

  logError(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    console.log('MethodsPage: ' + JSON.stringify(message,null,4) + ' ' + errStackTrace);
    this.SharedService.saveForLog((new Date().toISOString() + ': MethodsPage: ').concat(message).concat(errStackTrace));

  }

  //Runs when the page is about to be destroyed and have its elements removed.

  ionViewWillUnload(){
    //this.saveMethod();
  }

  ionViewWillLeave(){
    if(this.currentMethod.name == null){
      this.SharedService.presentAlert('Info','Enter a name and save the method before leaving','DISMISS');
      return;
    }
    //this.saveMethod(); //Will update method into database (but not the steps) and save all into localStorage.
  }
}
