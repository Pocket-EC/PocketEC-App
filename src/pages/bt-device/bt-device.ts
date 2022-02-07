import { Component,ViewChild,NgZone } from '@angular/core';
import { IonicPage, NavController,App, NavParams, Platform,AlertController,ToastController } from 'ionic-angular';
import { Observable } from 'rxjs/Observable';
import { Subscription} from 'rxjs/Subscription';
import { UploadJsonPage } from '../upload-json/upload-json';
import { DatabaseProvider } from '../../providers/database/database';
import { SharedserviceProvider } from '../../providers/sharedservice/sharedservice';
import { BtSerialProvider } from '../../providers/bt-serial/bt-serial'
import { TabsPage } from '../tabs/tabs';

/**
 * Generated class for the BtDevicePage page. Setting up the Bluetooth enabled device here.
 */

@IonicPage()
@Component({
	selector: 'page-bt-device',
	templateUrl: 'bt-device.html',
})


export class BtDevicePage {

	device: sensorDevice;
	mode: any; //sent by settings page to identify connect/setup scenarios.
	deviceConnected: boolean = false;
	displayDeviceConfig: boolean = true;
	showData: Boolean = false;
	connectingToDevice: boolean = false;
	databaseReady: boolean = false;
	dataFromDevice: String;
	storedData;
	write: String; // for commands
	keepChecking: boolean = true;
	startTimerForConnecting: Date;
	minDelayBetwTrials: number = 15;
	maxTimeForTrials: number = 60;
	stopConnecting;
	displaySetup: boolean = false;
	writeWithConfirm: boolean = false; // all writes will not check synchronous commn.
	writingFlag: boolean = false;
	@ViewChild('cmdInput') cmdInput ;
	public commands = []; //For storing commands for the BT device.
	commandsArray = [];

	expectedReplyLength: number = null;



	constructor( private ngZone: NgZone,
		public appCtrl: App,
		public alertCtrl: AlertController,
		private platform: Platform,
		public navCtrl: NavController,
		public toastController: ToastController,
		public navParams: NavParams,
		public DatabaseService: DatabaseProvider,
		public SharedService: SharedserviceProvider,
		public BtSerialService: BtSerialProvider) {

			this.platform.ready().then(() => {


			},(error) => {
					this.logError('Platform not ready for some reason: ',error);
					alert('Fatal error initializing app');
			});
	}

	/**
	* Check authentication status
	*/
	ionViewCanEnter() {
    this.SharedService.getAuth().then((val) => {
      if(!val){
        alert('Please log in first to access this page!');
				this.navCtrl.push(TabsPage,{index:"1"});
        return;
      }

		});
	}

	ionViewWillEnter(){
		this.SharedService.getAuth().then((val) => {
      if(val){
				//Is authenticated.

				this.device = this.navParams.get('device');
				this.mode = this.navParams.get('mode');

				if(this.mode == 1){
					this.connectToDevice(this.device.address); //Trigger connection process.
				}
				if(this.mode == 0) {
					this.connectToDevice(this.device.address); //Trigger connection process.
				}
			} //if not authenticated redirect to login
			else{
				this.navCtrl.push(TabsPage,{index:"1"});
				return;
			}
  	});
	}


	/**
	* Send the user entered read command to BT device and read the reply from the device.
	* @param data: string - command to be sent to device.
	* Ex: Voyager board expected values -  0 - set device in configure mode,
	 									4 157 3 - configure registers, to read Data
										4 157 7 - configure registers to read Temperature ,
										3 - read data
										2 - read temperature.
	*
	*/

	async sendToDevice(command:string) {

		if(command == undefined || command == null) {
			this.SharedService.showToast('Command to BT device is undefined','middle');
			return;
		}
		//Set writing flag..
		this.changeWriteFlag(true);
		if(this.SharedService.deviceSetting == null || this.SharedService.deviceSetting == undefined){
			this.SharedService.showToast('Config data missing! DeviceSetting is null or undefined','middle');
			return;
		}

		if(!this.SharedService.deviceSetting.test.RxAsString){
			if(this.expectedReplyLength == null || this.expectedReplyLength == undefined){
				this.SharedService.showToast('Enter a valid length for expercted response','middle');
				return;
			}
		}
		this.logError('Transmit as String: ' + this.SharedService.deviceSetting.test.TxAsString,'');
		this.logError('Recieve as String: ' + this.SharedService.deviceSetting.test.RxAsString,'');


		try{

			if(this.SharedService.deviceSetting.test.TxAsString){
				await this.BtSerialService.writeToDeviceAsChar(command);
				this.SharedService.showToast('Wrote to device as string');

			}
			else{
				await this.BtSerialService.writeToDevice(command); //depending on string will send command as char or array of bytes.
				this.SharedService.showToast('Wrote to device as array of bytes');

			}
			this.logError('Tx to device:'+command,new Date());

			let deviceReply = null;

			if(this.SharedService.deviceSetting.test.RxAsString){
				deviceReply = await this.readAsString();
			}
			else{
				let dataBuffer = await this.readRawData(this.expectedReplyLength);

				if(command === '3'){ //reading data, handle as LSB MSB
					deviceReply = String(this.DatabaseService.convertToInteger(new Uint8Array(dataBuffer)));
				}
				else if(command === '2'){
					let temperatureArray = new Uint8Array(dataBuffer)
					deviceReply = String(this.DatabaseService.convertTemperatureToCentigrade(temperatureArray[0],1));
					deviceReply = deviceReply.concat(' C | ' + temperatureArray[0]);
				}
				else{
					deviceReply = String.fromCharCode.apply(null, new Uint8Array(dataBuffer));
				}

			}
			this.logError('Rx from device: ' + deviceReply,new Date());
			if(deviceReply == null || deviceReply.length == 0){
				alert('No response detected from the device');
				this.changeWriteFlag(false);
				return;
			}
			this.SharedService.showToast('From device: ' + deviceReply);
			this.createCommand(command,deviceReply);
			this.changeWriteFlag(false);
		}
		catch(error){
			this.changeWriteFlag(false);
			this.logError('Error writing to device: ' + command ,error);
			alert('Error writing to device: ' + command + ' error: ' + error);
		}
	}

	/**
	* Check if bytes are available to be read from BT device and read data as a string.
	* @return Reply to read command returned as a string .
	*
	*/

	async readAsString(){
		let dataBuffer = [];
    let timerForAlert = new Date();
    let dataString = '';
    let rawBytesSubscription = null;
    let checkForDelayTimer$ = null;
		//let promise = new Promise<string>((resolve,reject)=>{
		try{
			checkForDelayTimer$ = Observable.timer(3000).subscribe((command)=>{
				try{
        	this.startTimerForDeviceResponseDelay(timerForAlert,rawBytesSubscription,dataBuffer,dataString);
				}
				catch(error){
					this.logError('Error from timer ', error);
					this.changeWriteFlag(false);
					alert('No response from device');
				}
      });
			this.keepChecking = true;
			try{
	      while(this.keepChecking){
	        let bytes = await this.BtSerialService.checkIfBytesAvailable();
	        if(bytes > 0){
	          dataString = await this.BtSerialService.readFromDevice();
	          this.keepChecking = false;
	          await this.BtSerialService.clearBuffer();
						timerForAlert = null;
						checkForDelayTimer$.unsubscribe();
	          break;
	        }
	        await this.waitFunction(10);
	      }
	      return dataString;
	    }
	    catch(error){
	      this.logError('Error in read as string:  ',error);
	      throw error;
	    }
		}
		catch(error){
			this.logError('Error in read as string:  ',error);
			throw error;
		}
	}


	/**
	* Reads data from the buffer until it reaches a delimiter
	* Empty string is returned if there is no data available.
	* @param checkForDelayTimer$ timer to unsubscribe from if data is available to be read.
	* @param timerForAlert Timer date object that is reset if data is available to be read.
	* @param delimiter expected end of data delimiter in the buffer.
	* @return data read from buffer is returned a string.
	*/


	async readUntilDelimitter(checkForDelayTimer$,timerForAlert,delimiter){
		try{
			let deviceReply = '';
			while(this.keepChecking){

				let bytes = await	this.BtSerialService.checkIfBytesAvailable();
				if(bytes > 0){
					deviceReply = await this.BtSerialService.readUntil(delimiter);
					await this.BtSerialService.clearBuffer();
					this.keepChecking = false;
					timerForAlert = null;
					checkForDelayTimer$.unsubscribe();
					break;
				}
				await this.waitFunction(100);
			}
			//this.logError('printing deviceReply': deviceReply,'');
			return deviceReply;
		}
		catch(error){
			this.logError('Error in startReading: ', error);
			throw error;
		}
	}

	/**
	* Creates a delay in while loop
	* @param delay - required delay length
	*/
	waitFunction(delay){
		let promise = new Promise<boolean>((resolve,reject)=>{
			setTimeout(()=>{
				resolve(true);
			},delay);
		});
		return promise;
	}

	/**
	* Reads device response as bytes,
	* @param reqdLength - no. of bytes expected from device.
	* @return data is sent back as an ArrayBuffer
	*/

	readRawData(reqdLength){
		let dataBuffer = [];
    let timerForAlert = new Date();
    let dataString = '';
    let rawBytesObserver: Observable<any> = null;
    let rawBytesSubscription = null;
    let checkForDelayTimer$ = null;

		this.logError('readRawData: reqdLength: ' + reqdLength,'');

    let promise = new Promise<number[]>((resolve,reject)=>{
      checkForDelayTimer$ = Observable.timer(3000).subscribe((data)=>{
				try{
        	this.startTimerForDeviceResponseDelay(timerForAlert,rawBytesSubscription,dataBuffer,dataString);
				}
				catch(error){
					this.logError('Error from timer, rawData ', error);
					this.changeWriteFlag(false);
					alert('No response from device');
				}
      });
      rawBytesObserver = this.BtSerialService.subscribeRawData();
      rawBytesSubscription = rawBytesObserver.subscribe((dt)=>{
        let tempBuffer = new Uint8Array(dt);
				//this.logError('Printing tempBuffer in readRawData: ',tempBuffer);
        let tempBufferLength = tempBuffer.length;
        for(var i=0; i<tempBufferLength; i++){
          dataBuffer.push(tempBuffer[i]);
        }

        if(dataBuffer.length == reqdLength){
          if(rawBytesSubscription!= null){
            rawBytesSubscription.unsubscribe();
          }
          timerForAlert = null;
          checkForDelayTimer$.unsubscribe();
					this.logError('Printing data from buffer in bytes: ',dataBuffer);
					resolve(dataBuffer);
        }
        if(dataBuffer.length > reqdLength){
          this.logError('Wrong response length: ' + dataBuffer.length +' data: '+ new Uint8Array(dataBuffer),'');
          if(rawBytesSubscription!= null){
            rawBytesSubscription.unsubscribe();
          }
          timerForAlert = null;
          checkForDelayTimer$.unsubscribe();
          reject('Wrong length of response! ');
        }
      },(subscribeError)=>{
        this.SharedService.showToast('Device ' + this.device.name + ' does not allow subscription to raw data. Error Code: RDFD ');
        this.logError('Could not subscribe to raw data from device:  ',subscribeError);

        reject(subscribeError);
      });
    }).catch(error=>{
      this.logError('Error in reading data as bytes array. ',error);
      throw error;
    });

    return promise;
  }

	/**
	* Called when phone stops waiting for a response from the device.
	* @param timerForAlert date object denoting start of timer for response from BT device
	* @param rawBytesSubscription handle for reading bytes from buffer
	* @param dataBuffer arrayBuffer that contaings data read from buffer.
	* @param dataString data read as string from buffer.
	*
	*/

	startTimerForDeviceResponseDelay(timerForAlert: Date, rawBytesSubscription: Subscription, dataBuffer:number[],dataString:string):String{
		this.keepChecking = false;
		this.logError('Delay timer handler starts','');
    if(timerForAlert == null){
      this.logError('Timer is null, received data, checking for empty dataset. ','');

      if(this.SharedService.deviceSetting.test.RxAsString){
        if(dataString === ""){
          this.logError('Returned nothing','');
        }
        return dataString;
      }
      else{
        if(rawBytesSubscription != null){
          rawBytesSubscription.unsubscribe();
        }
        if(dataBuffer.length==0){
          this.logError('Returned nothing','');
          return String.fromCharCode.apply(null, new Uint8Array([32]));
        }
        else{
          return String.fromCharCode.apply(null, new Uint8Array(dataBuffer));
        }
      }
    }
    else{
      this.logError('read Data Response time > 3s at: ' + timerForAlert.toISOString(),'');

      if(this.SharedService.deviceSetting.test.RxAsString){
        if(dataString.length==0){
          throw Error('No data returned')
        }
        else{
          throw Error(dataString);
        }
      }
      else{
        if(rawBytesSubscription!= null){
          rawBytesSubscription.unsubscribe();
        }
        if(dataBuffer.length==0){
          this.logError('returned N','');
          throw Error('No data returned');
        }
        else{
          throw Error('Converted bytes to string: ' + String.fromCharCode.apply(null, new Uint8Array(dataBuffer)));
        }
      }
    }

  }




	/** Subroutine provided to configure boot setup for BT device - remove unwanted commands from list.
	* @param delCmd command to be deleted from the list of commands. requires global commands array.
	*/
	deleteFromCommands(delCmd){
		this.deleteFromCommandsArray(delCmd);
		this.commands = this.commands.filter((command)=>{
			return command.id != delCmd.id;
		});
	}

	//Subroutine provided to configure boot setup for BT device - remove unwanted commands from here.
	deleteFromCommandsArray(delCmd){
		this.commandsArray = this.commandsArray.filter((command)=>{
			return command.id != delCmd.id;
		});
	}

	/**
	* Set boolean flag to display spinner when BT device write is in progress
	* @param flag boolean value to set
	*/

	changeWriteFlag(flag){
		this.ngZone.run(() => {
			this.writingFlag = flag;
		});
	}

 /**
 * Disconnect the bluetooth device from phone.
 *
 */
	disconnectDevice(){
		this.BtSerialService.disconnectDevice().then((disconn) => {
			this.logError('Device disconnected ','');
			this.changeConnectionStatus(false,false);
		},(error) => {
			this.logError('Device not disconnected after read ',error);
			alert('Device could not be disconnected');
		});
	}

	/**
	* Used when  connecting to a device for the first time.
	* @param address mac address of device to be connected to.
	*/

	connectToDevice(address){
		this.stopConnecting = true;
		this.connectingToDevice = true;
		//this.logError('ConnectToDevice called ','');
		this.BtSerialService.connectToDevice(address)
		.takeWhile(() => this.stopConnecting ) //this.stopConnecting has to be false for unsubscribe
		.subscribe((connected) => {
			this.logError('Device connected','');
			this.callSuccess(connected);
			this.stopConnecting = false; //Unsubscribe from connect observable here.
		},(error)=>{
			this.logError('Disconnected : ', error );
			this.changeConnectionStatus(true,false);
			this.displaySetup = false; //there should be some kind of memory here to recall the display once connection is established.
			this.connectToDevice(address);
		});
	}


	/**
	* Control view status display spinner as required - connectingToDevice and deviceStatus is deviceConnected
	*/

	changeConnectionStatus(status,deviceStatus) {
		this.ngZone.run(() => {
			this.connectingToDevice = status;
			this.deviceConnected = deviceStatus;
		});
	}

	/**
	* Handler for bluetoothserial.connect success
	*/

	async callSuccess(data) {
		try{
			this.device.userId = this.SharedService.getUserId();
			this.device.deviceId = await this.DatabaseService.saveDevice(this.device);
			this.SharedService.setDevice(this.device);
			//set default deviceSetting
			this.ngZone.run(() => {
				this.changeConnectionStatus(false,true);
				this.writeWithConfirm = false;
			});
		}
		catch(error){
			this.changeWriteFlag(false);
			this.logError('Device was connected but error saving config to database',error);
			alert('Device could not be saved to the local database at this time. ');
		}
	}

	/**
	* Add command to device and its response to command history (for viewing and exporting).
	* @param cmd: string User entered command to send to device
	* @param response: string response obtained from device for command.
	*/
	createCommand(cmd,response):void{
		let uniqueKey = new Date().getMilliseconds();
		let newCommand = {
			id: uniqueKey,
			cmd: cmd,
			reply: response,
			add: false
		};
		this.ngZone.run(() => {
			this.commands.push(newCommand);
			this.commandsArray.push('Sent: ' + cmd + ' Recd: ' + response);
			this.write = '';
		});
		this.changeWriteFlag(false);
	}

	//Handler for bluetoothserial.connect error if displaying 'manual reconnect' message

 	callError(error,message):void{
 		this.ngZone.run(() => {
		 	this.changeConnectionStatus(false,false);
   		this.logError('CallError ' + message + ' **** ',error);
    });
 	}



//Disconnect button handler - disconnects device.
//Not to be called for programmatic disconnect as it uses an ALERT requiring manual input.

disconnect():void {
	let alert = this.alertCtrl.create({
		title: 'Disconnect?',
		message: 'Do you want to Disconnect?',
		buttons: [
			{
				text: 'Cancel',
				role: 'cancel',
				handler: () => {
					this.logError('Cancel clicked','');
				}
			},
			{
				text: 'Disconnect',
				handler: () => {
					this.BtSerialService.disconnectDevice().then((success) => {
						this.logError('Disconnected!','');
						this.navCtrl.pop();
					},(error) => {
						this.logError('Error disconnecting: ',error);
					});
				}
			}
		]
	});
	alert.present();
}



	/**
	* Disconnect device and signal that its free for DataReaderService
	*
	*/

	ionViewWillLeave(){
		this.BtSerialService.disconnectDevice().then((disconnected) =>{
			this.logError('Device disconnected on view exit','');
			//clean up view
			this.deviceConnected = false;
			this.connectingToDevice = false;
		},(error) => {
			this.logError('Device could not be disconnected ',error);
		});
	}


	/**
	* Download history of commands sent to device and responses recieved in this session.
	*
	*/
	exportCommandHistory(){
		if(this.commands.length == 0){
			alert('No device communications to export');
			return;
		}

		let today = new Date();
    let filename = this.SharedService.convertDateForFileName(today);
		filename = filename.concat('deviceComm.csv');
		let message = 'Please find attached a copy of the commands sent and responses received from the device. ' + this.SharedService.deviceName;
		this.SharedService.downloadFile(this.commandsArray,'List of commands and responses',filename,'Device communication',message);
	}
	/**
	* Navigate to new page to add/edit configuration settings for device.
	*
	*/
	goToUpload(){
    this.navCtrl.push(UploadJsonPage);
  }

	//Log error to save and print for debugging.
  logError(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    console.log('BtDevicePage: ' +message + ' ' + errStackTrace);
    this.SharedService.saveForLog((new Date().toISOString() + ': BtDevicePage: ').concat(message).concat(errStackTrace));
  }
}
