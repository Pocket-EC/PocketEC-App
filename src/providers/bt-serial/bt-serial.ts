import { Injectable } from '@angular/core';
import { Platform} from 'ionic-angular';
import { BluetoothSerial } from '@ionic-native/bluetooth-serial';
import { BehaviorSubject } from 'rxjs/Rx'
import { Observable } from 'rxjs/Rx'
import { ReplaySubject } from 'rxjs/Rx'
import { SharedserviceProvider } from '../../providers/sharedservice/sharedservice';



/**
* Service Wrapper for BluetoothSerial plugin
*/


@Injectable()
export class BtSerialProvider {

 public deviceConnected: BehaviorSubject<boolean>;
 connectingToDevice: boolean;
 public resultSubject:ReplaySubject<any> = new ReplaySubject(1);
 tryingToConnect: boolean = false;
 public deviceObservable: Observable<any>;


  constructor(private bluetoothSerial: BluetoothSerial,
              private platform: Platform,
              private SharedService: SharedserviceProvider) {

    this.deviceConnected = new BehaviorSubject(false);

    this.platform.ready().then(() => {

			//Check if bluetooth is enabled on device
			this.bluetoothSerial.isEnabled().then((enabled) => {
	     this.logError('bluetooth enabled','');
	    },(error) => {
        this.logError('bluetooth not enabled','');
        //enable it then
        this.bluetoothSerial.enable().then((enabled) => {
          this.logError('bluetooth was enabled successfully','');
        },(error) => {
          this.logError('bluetooth could not be enabled: ',error);
          alert('Please enable bluetooth in your phone settings');
        });
      });
		},(error) => {
			this.logError('Platform not ready for some reason: ',error);
			alert('Fatal error initializing app');
		});
  }


  // Connection to device function

  connectionStatus(): Promise<any> {
    this.connectingToDevice = true;
    return this.bluetoothSerial.isConnected();
  }


  //Connect to device.
  connectToDevice(address: string): Observable<any>{
    this.deviceObservable = this.bluetoothSerial.connect(address);
    return this.deviceObservable;
  }

  //Write to device //TODO voyager board specific. change to bytes only Tx

  writeToDevice(data:string): Promise<Date>{
  // this.logError('Printing transmitBoth ' + this.SharedService.transmitBoth,'');
    // if(this.SharedService.deviceSetting){
      let dataArray = data.split(" ");
      let dataLength = dataArray.length;
      let dataBuffer = new Uint8Array(dataLength);
      for(var i= 0; i<dataLength;i++){
        dataBuffer[i]=parseInt(dataArray[i]);
      }

      //if true write as string to chip.
      if(dataBuffer.length == 1){
        let promise = new Promise<Date>((resolve,reject) => {
          //this.logError('Sent as string','');
          this.bluetoothSerial.write(data).then((confirm) => {
            let timestamp = new Date();
            resolve(timestamp);
          }, (error) =>{
            reject(error);
          });
        });
        return promise;
      }
      else{
        let promise = new Promise<Date>((resolve,reject) => {
          // this.logError('Sent as bytes array','');
          this.bluetoothSerial.write(dataBuffer).then((confirm) => {
            let timestamp = new Date();
            resolve(timestamp);
          }, (error) =>{
            reject(error);
          });
        });
        return promise;
      }
    // }
    // else{
    //   return this.writeToDeviceAsChar(data);
    // }
  }

  /*Created separate method for sending as character to make it faster*/


  writeToDeviceAsChar(data:string): Promise<Date>{

    let promise = new Promise<Date>((resolve,reject) => {
      //this.logError('Sent as string','');
      this.bluetoothSerial.write(data).then((confirm) => {
        let timestamp = new Date();

        resolve(timestamp);
      }, (error) =>{
        this.logError('Error in write data call ',error);
        reject(error);
      });
    });
    return  promise;
  }


  subscribeRawData(): Observable<any>{
    return this.bluetoothSerial.subscribeRawData();
  }

  subscribe(delimiter): Observable<any>{
    return this.bluetoothSerial.subscribe(delimiter);
  }

  readUntil(delimiter): Promise<any>{
    return this.bluetoothSerial.readUntil(delimiter);
  }

  //read from device.
  readFromDevice(): Promise <any> {
    return this.bluetoothSerial.read();
  }

  checkIfBytesAvailable(): Promise<any>{
    return this.bluetoothSerial.available();
  }

  //Disconnect - disconnects device.
	disconnectDevice(): Promise<any>{
    this.deviceObservable = null; //for GC
		return this.bluetoothSerial.disconnect();
	}

  //fetch Unpaired
  fetchUnpairedDevices(){
    return this.bluetoothSerial.discoverUnpaired();
  }

  fetchPairedDevices(){
    return this.bluetoothSerial.list();
  }

  subscribeToread(): Observable<any>{
    return this.bluetoothSerial.subscribeRawData();
  }

  clearBuffer(): Promise<any>{
    return this.bluetoothSerial.clear();
  }
  //Log error to save and print for debugging.

  logError(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    console.log('BtSerialService: ' +message + ' ' +errStackTrace);
    this.SharedService.saveForLog((new Date().toISOString() + ': BtSerialProvider: ').concat(message).concat(errStackTrace));
    //this.downloadDebugFile(false);
  }
}
