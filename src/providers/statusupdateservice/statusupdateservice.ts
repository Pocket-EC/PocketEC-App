import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Rx';
import { SharedserviceProvider } from '../sharedservice/sharedservice';


/**
* @author vm
* This service is used to share the data between the different Controllers
*
*/


@Injectable()
export class StatusUpdateProvider {

  //HomePage variables shared with other components
  statusUpdateForUser: string;
  statusUpdateForUser$: Subject<string>;
  stopExperiment: boolean = false;
  stopExperiment$: Subject<boolean>;
  currentExperimentId: number;

  experimentRunning: boolean = false;   //Is true when experiment is running.
  experimentRunning$: Subject<boolean>;
  showLoadingSpinner: boolean = false;
  showLoadingSpinner$: Subject<boolean>;
  spinnerText: string = '';
  spinnerText$: Subject<string>;
  disableButton: boolean = false;
  disableButton$: Subject<boolean>;



  lastSampledTime: Date = null;
  lastSampledTime$: Subject<Date>;
  exptStartTime: string;
  exptStartTime$: Subject<string>;
  latestDataForCharts: experimentDataObject = null;
  stoppedWithError: Error;
  stoppedWithError$: Subject<Error>;
  lastMeasuredConcentration: string;
  lastMeasuredConcentration$: Subject<string>;
  deviceIsBusy: boolean = false;

  constructor(private SharedService: SharedserviceProvider) {


    //Initialize BehaviorSubject for starting sampling with default value hard coded.

    this.statusUpdateForUser$ = new Subject();
    this.stopExperiment$ = new Subject();
    this.experimentRunning$ = new Subject();
    this.showLoadingSpinner$ = new Subject();
    this.spinnerText$ = new Subject();
    this.disableButton$ = new Subject();
    this.lastSampledTime$ = new Subject();
    this.exptStartTime$ = new Subject();
    this.stoppedWithError$ = new Subject();
    this.lastMeasuredConcentration$ = new Subject();
  }

  /**
  * This variable should be set before trying to connect to device and reset when device disconnected.
  *
  */

  setDeviceIsBusy(busy:boolean):void{
    this.deviceIsBusy = busy;
  }

  subscribeToLastMeasuredConcentration(){
    return this.lastMeasuredConcentration$.asObservable();
  }

  setLastMeasuredConcentration(value:string){
    this.lastMeasuredConcentration = value;
    this.lastMeasuredConcentration$.next(value);
  }


  subscribeToExperimentStatus(){
    return this.experimentRunning$.asObservable();
  }


  setExperimentStatus(value:boolean){
    this.experimentRunning = value;
    this.experimentRunning$.next(value);
  }
  //for those functions that do not need updates as soon as there is a change in value.
  getExperimentStatus(){
    return this.experimentRunning;
  }

  subscribeToSpinnerText(){
    return this.spinnerText$.asObservable();
  }

  setSpinnerText(text:string){
    this.spinnerText = text;
    this.spinnerText$.next(text);
  }

  setStoppedWithError(error:Error){
    this.stoppedWithError = error;
    this.stoppedWithError$.next(error);
  }

  subscribeToStoppedWithError(){
    return this.stoppedWithError$.asObservable();
  }

  subscribeToShowSpinner(){
    return this.showLoadingSpinner$.asObservable();
  }

  setLoadingSpinner(show:boolean){
    this.showLoadingSpinner = show;
    this.showLoadingSpinner$.next(show);
  }

  subscribeToButtonDisableFlag(){
    return this.disableButton$.asObservable();
  }

  setDisableButton(disable:boolean){
    this.disableButton = disable;
    this.disableButton$.next(disable);
  }

  subscribeToLastSampledTime(){
    return this.lastSampledTime$.asObservable();
  }
  setLastSampledTime(timeStamp: Date){
    this.lastSampledTime = timeStamp;
    this.lastSampledTime$.next(timeStamp);
  }

  subscribeToExptStartTime(){
    return this.exptStartTime$.asObservable();
  }

  setExptStartTime(name:string){
    this.exptStartTime = name;
    this.exptStartTime$.next(name);
  }


  setStatusUpdate(value){
    this.statusUpdateForUser = value;
    this.statusUpdateForUser$.next(value);
  }


  subscribeToStatusUpdate(){
    return this.statusUpdateForUser$.asObservable();
  }

  setCurrentExperimentId(experimentId){
    this.currentExperimentId = experimentId;
  }
  getCurrentExperimentId(){
    return this.currentExperimentId;
  }

  setStopExperiment(stop:boolean){
    this.stopExperiment = stop;
    this.stopExperiment$.next(stop);
  }

  subscribeToStopExperiment(){
    return this.stopExperiment$.asObservable();
  }


  logError(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    console.log('SharedService: ' + JSON.stringify(message, null,4) + ' ' + errStackTrace);
    this.SharedService.saveForLog((new Date().toISOString() + ': SharedService: ').concat(message).concat(errStackTrace));
  }

}
