
import { Injectable } from '@angular/core';
import { Platform} from 'ionic-angular';
import { SQLite, SQLiteObject } from '@ionic-native/sqlite';
import { Subject,Observable } from 'rxjs/Rx'
import 'rxjs/add/observable/fromPromise';
import { SharedserviceProvider } from '../sharedservice/sharedservice';



/*
  @author vm

*/
@Injectable()
export class DatabaseProvider {

  database: SQLiteObject;
  tablesCreated: boolean = false;
  private databaseReady: Subject<boolean>;


  experimentDataForCharts: experimentDataObject = {
    length:0,
    experimentId: null,
    dataArray:[],
    chartDateArray:[],
    currentArray: [],
    stepIdArray:[],
    temperatureArray:[],
    noOfMeasurementsPerStepArray: [],
    stepStartTimeArray: [],
    method: null
  };



  private flagForDatabaseTransaction: boolean = false;


  constructor(private platform: Platform, public sqLite: SQLite, private SharedService: SharedserviceProvider) {
    try{
      const DATABASE_VERSION = 5.1; //Update required new database version here.
      this.platform.ready()
      .then(() => {
        this.databaseReady = new Subject();
        let versionNo = 0.0; //This will hold the database version from phone local storage.
        this.sqLite.create({
          name: 'developers.db',
          location: 'default'
        })
        .then((db: SQLiteObject) => {
          this.database = db;
          return db.executeSql('CREATE TABLE IF NOT EXISTS user(rowid INTEGER PRIMARY KEY, email TEXT, name TEXT,remoteDbId INTEGER)',{});
        })
        .then(res => {
          this.logError('Created table user' + JSON.stringify(res,null,4),res);
          return this.database.executeSql('CREATE TABLE IF NOT EXISTS serverUpdate(rowid INTEGER PRIMARY KEY, date TEXT, time TEXT, newData BOOLEAN)',{});
        })
        .then(res => {
          this.logError('Created table serverUpdate',res);
          return this.createMethodsTable();
        })
        .then((res) => {
          this.logError('Created table methods and step',res);
          return this.createPostProcessingParamsTable();
        }).then(() => {
          this.logError('Created table postProcessingParams','');
          return this.createExperimentTable();
        })
        .then((res) => {
          this.logError('Created experiments table','');
          return this.createCalibrationTable();
        })
        .then(() => { //TODO boolean needs to become integer.
          this.logError('Created Calibrations table','');
          return this.database.executeSql('CREATE TABLE IF NOT EXISTS sensorData(rowid INTEGER PRIMARY KEY, date TEXT, time TEXT, chartDate TEXT, data TEXT, current NUMBER, stepNumber INTEGER, serverUpdated Boolean,dateUpdated TEXT, sessions_sessionId TEXT, experimentId INTEGER, stepId INTEGER, noOfMeasurementsPerStep INTEGER,stepStartTime TEXT,timezoneOffset TEXT NOT NULL DEFAULT (0),temperature REAL,rawTempReading TEXT,FOREIGN KEY(stepId) REFERENCES step(rowid),FOREIGN KEY(experimentId) REFERENCES experiments(rowid),FOREIGN KEY(sessions_sessionId) REFERENCES sessions(sessionId))', {});
        })
        .then(res => {
          this.logError('Created table sensorData ' + JSON.stringify(res,null,4),res);
          return this.database.executeSql('CREATE TABLE IF NOT EXISTS sessions(rowid INTEGER PRIMARY KEY, date TEXT, time TEXT, sessionId TEXT,userId INTEGER, FOREIGN KEY(userId) REFERENCES user(rowid))',{});
        })
        .then(res => {
          this.logError('Created table session ' + JSON.stringify(res,null,4),res);
          return this.database.executeSql('CREATE TABLE IF NOT EXISTS sensorDevice(rowid INTEGER PRIMARY KEY, name TEXT, id TEXT, address TEXT, class TEXT,userId INTEGER,configId INTEGER, FOREIGN KEY(userId) REFERENCES user(rowid))',{});
        })
        .then(res => {
          this.logError('Created table sensorDevice ' + JSON.stringify(res,null,4),res);
          return this.database.executeSql('CREATE TABLE IF NOT EXISTS databaseVersion(rowid INTEGER PRIMARY KEY, version REAL)',{});
        })
        .then(res => {
          this.logError('Created table databaseVersion ' + JSON.stringify(res,null,4),res);
          return this.database.executeSql('SELECT version from databaseVersion',[]);
        })
        .then(version=>{
          this.logError('Printing version no. of database ' + JSON.stringify(version),'');

          if(version.rows.length == 0){
            this.logError('Database is version 1.0 without an entry for version','');
            versionNo = 1.0;
            return this.database.executeSql('Insert into databaseVersion (version) values(?)',[1.0]);
          }
          else{
            versionNo = version.rows.item(0).version;
            this.logError('Database version > 1.0. Is version no: ',versionNo);
          }
        })
        .then(()=>{
          if(versionNo == 1.0){
            this.logError('Changing schema from version 1 to 3 create new temperature table','');
            return this.database.executeSql('CREATE TABLE IF NOT EXISTS temperature(rowid INTEGER PRIMARY KEY, temperature TEXT, date TEXT,command TEXT,dateYYYYMMDD TEXT,rawTempReading TEXT)',{});
          }
        })
        .then(()=>{
          if(versionNo == 1.0){
            versionNo = 3.2
            return this.database.executeSql('UPDATE databaseVersion SET version=?',[3.2]);
          }
        })
        .then(()=>{
          if(versionNo == 3.2){
            this.logError('Database version is 3.2, altering temperature table. change to 3.3','');
            return this.database.executeSql('ALTER TABLE temperature ADD COLUMN timezoneOffset TEXT NOT NULL DEFAULT (0)',[]);
          }
        })
        .then(()=>{
          if(versionNo == 3.2){
            this.logError('Database version is 3.2, add chartDate to temperature table','');
            return this.database.executeSql('ALTER TABLE temperature ADD COLUMN chartDate TEXT NOT NULL DEFAULT (0)',[]);
          }
        })
        .then(()=>{
          if(versionNo == 3.2){
            versionNo = 3.5;
            this.logError('Update database version to 3.5','');
            return this.database.executeSql('UPDATE databaseVersion SET version=?',[versionNo]);
          }
        })
        .then(()=>{ //Adding new field step to sensorData - will hold no. of datapoints in the step
          if(versionNo == 3.5){
            this.logError('Database version is 3.5, make changes to upgrade to 4.0',''); //TODO remove after checking.
            return this.database.executeSql('ALTER TABLE sensorData ADD COLUMN step TEXT NOT NULL DEFAULT (0)',[]);
          }
        })
        .then(()=>{
          if(versionNo == 3.5){
            versionNo = 5.0;
            return this.database.executeSql('UPDATE databaseVersion SET version=?',[versionNo]);
          }
        })
        .then(()=>{
          if(versionNo == 5.0){
            this.logError('Database version is 5.0, make changes to upgrade to 5.1',''); //TODO remove after checking.
            return this.createDeviceConfigTable();
          }
        })
        .then(()=>{
          if(versionNo == 5.0){
            versionNo = 5.1;
            return this.database.executeSql('UPDATE databaseVersion SET version=?',[versionNo]);
          }
        })
        .then(()=>{
          if(versionNo == DATABASE_VERSION){
            this.logError('Database version is ' + DATABASE_VERSION + ', do not do anything','');
          }
        })
        .then(()=>{
          this.tablesCreated = true;
          this.databaseReady.next(true);
        },(error) =>{
          this.logError('Error creating tables: ',error);
          this.tablesCreated = false;
          this.databaseReady.next(false);
          //throw error;
        });
      },(err) =>{
        this.logError('Platform not ready', err);
        throw err;
      });
    }
    catch(e){
      if(e instanceof Error) {
        // IDE type hinting now available
        // properly handle Error e
        this.logError('Error creating tables: ',e);
      }
      else {
        // probably cannot recover...therefore, rethrow
        throw e;
      }
    }
  }

  /**
  * Stores data recorded per step
  * @param arrayOfMeasurements: measurement[] (data as string or as bytes along with datetimestamp)
  * @param experimentId number: unique database row id of the experiment who's step data is being saved
  * @param stepId: number unique database row id of the step
  * @param temperature: temperature measured after a step - is a string.
  * @param stepStartTime: Date object storing date and time of start of step.
  */


  addStepData(stepData: stepData, experimentId:number,stepId:number,stepNumber:number,temperature,stepStartTime: Date): Promise<experimentDataObject>{
    //this.logError('Length of array to be stored: ' + dataLength,'');
    let promise = new Promise<experimentDataObject>((resolve,reject) =>{
      this.createSqlArray(stepData,experimentId,stepId,stepNumber,temperature,stepStartTime).then((sqlArray)=>{
        if(sqlArray.length == 0){
          reject('0 length array created');
        }
        if (this.tablesCreated) {
          this.database.sqlBatch(sqlArray).then((data) => {

            this.SharedService.addDataToCharts(this.experimentDataForCharts);
            resolve(this.experimentDataForCharts);
          },(error)=>{
            this.logError('Error inserting array of data ',error);
            reject(error);
          });
        }
        else{
          reject('Fatal Error: Message - Database not ready in local device');
        }
      },(error1)=>{
        this.logError('Error creating array of data ',error1);
        reject(error1);
      });
    });
    return promise;
  }


  //TODO - create error handle
  /**
  * Creates and array of sql statements for inserting measured data.

  * @param arrayOfMeasurements: measurement - defined in DataReaderService
  * @param experimentId: unique database row id that is created everytime a new experiment is started
  * @param stepId: unique database row id for step who's data is being saved.
  * @param rawTempReading: temperature measured after a step.
  * @param stepStartTime: Date object storing date and time of start of step.
  *
  **/

  createSqlArray(stepData: stepData,experimentId,stepId,stepNumber,rawTempReading: string,stepStartTime:Date):Promise<any>{

    let promise = new Promise((resolve,reject)=>{
      let sqlArray = [];
      let length = 0;

      this.experimentDataForCharts.length = 0;
      this.experimentDataForCharts.chartDateArray =  [];
      this.experimentDataForCharts.dataArray= [];
      this.experimentDataForCharts.stepIdArray = [];
      this.experimentDataForCharts.temperatureArray = [];
      length = stepData.data.length;


      let dateFormatted;
      let timeFormatted;
      let chartDate;
      let reading;
      let current: number = null;
      let measurementRef;
      let roundedTemperature;

      //First row of step includes number of data samples in step.

      measurementRef = stepData.data[0];
      dateFormatted = this.convertDateToYYYYMMDD(measurementRef.date);
      timeFormatted = this.convertDatetoHHMMSSMS(measurementRef.date);
      chartDate = measurementRef.date.toISOString();
      if(this.SharedService.deviceSetting.readData.RxAsString){
        reading = measurementRef.dataString;
      }
      else{
        reading = String(this.convertToInteger(measurementRef.dataBytesArray));
      }
      current = ((reading as any) - (stepData.zeroOffset as any) ) * (stepData.scalingFactor as any);
      sqlArray.push(['INSERT into sensorData (date,time,data,current,chartDate,stepNumber,timezoneOffset,experimentId,stepId,noOfMeasurementsPerStep,stepStartTime) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [dateFormatted,timeFormatted,reading,current,chartDate,stepNumber,measurementRef.date.getTimezoneOffset(),experimentId,stepId,stepData.data.length,stepStartTime.toISOString()]]);

      this.experimentDataForCharts.dataArray.push(reading);
      this.experimentDataForCharts.currentArray.push(current);
      this.experimentDataForCharts.chartDateArray.push(chartDate);

      this.experimentDataForCharts.stepIdArray.push(stepNumber);
      this.experimentDataForCharts.temperatureArray.push(null);

      //Rest of data points except last added
      for(var i=1;i<(length-1);i++){
        measurementRef = stepData.data[i];
        dateFormatted = this.convertDateToYYYYMMDD(measurementRef.date);
        timeFormatted = this.convertDatetoHHMMSSMS(measurementRef.date);
        chartDate = measurementRef.date.toISOString();
        if(this.SharedService.deviceSetting.readData.RxAsString){
          reading = measurementRef.dataString;
        }
        else{
          reading = String(this.convertToInteger(measurementRef.dataBytesArray));
        }
        current = ((reading as any) - (stepData.zeroOffset as any) ) * (stepData.scalingFactor as any);
        sqlArray.push(['INSERT into sensorData (date,time,data,current,chartDate,stepNumber,timezoneOffset,experimentId,stepId) VALUES (?,?,?,?,?,?,?,?,?)',
        [dateFormatted,timeFormatted,reading,current,chartDate,stepNumber,measurementRef.date.getTimezoneOffset(),experimentId,stepId]]);

        this.experimentDataForCharts.dataArray.push(reading);
        this.experimentDataForCharts.currentArray.push(current);
        this.experimentDataForCharts.chartDateArray.push(chartDate);
        this.experimentDataForCharts.stepIdArray.push(stepNumber);
        this.experimentDataForCharts.temperatureArray.push(null);
      }
      // last step added along with temperature.
      measurementRef = stepData.data[length-1];
      dateFormatted = this.convertDateToYYYYMMDD(measurementRef.date);
      timeFormatted = this.convertDatetoHHMMSSMS(measurementRef.date);
      chartDate = measurementRef.date.toISOString();
      if(this.SharedService.deviceSetting.readData.RxAsString){
        reading = measurementRef.dataString;
        roundedTemperature = rawTempReading;
      }
      else{
        reading = String(this.convertToInteger(measurementRef.dataBytesArray));
        if(rawTempReading == null){
          roundedTemperature = null;
        }
        else{
          roundedTemperature = this.convertTemperatureToCentigrade(rawTempReading,1);
        }
      }
      current = ((reading as any) - (stepData.zeroOffset as any) ) * (stepData.scalingFactor as any);

      sqlArray.push(['INSERT into sensorData (date,time,data,current,chartDate,stepNumber,timezoneOffset,experimentId,stepId,rawTempReading,temperature) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [dateFormatted,timeFormatted,reading,current,chartDate,stepNumber,measurementRef.date.getTimezoneOffset(),experimentId,stepId,rawTempReading,roundedTemperature]]);

      this.experimentDataForCharts.dataArray.push(reading);
      this.experimentDataForCharts.currentArray.push(current);
      this.experimentDataForCharts.chartDateArray.push(chartDate);
      this.experimentDataForCharts.stepIdArray.push(stepNumber);
      this.experimentDataForCharts.temperatureArray.push(roundedTemperature);

      this.SharedService.setLastDate(this.experimentDataForCharts.chartDateArray[0]); //for other components like charts and analysis
      this.experimentDataForCharts.length = length;
      this.experimentDataForCharts.experimentId = experimentId;

      resolve(sqlArray);
    });
    return promise;
  }



  /**
  * Function to convert data recieved from voyager into readings. (MSB << 8) + LSB
  * @param dataBufferArray contains array of bytes LSB MSB CR
  * @return converted sensor reading
  */


  convertToInteger(dataBufferArray){
    let value = ( dataBufferArray[1] << 8 ) + dataBufferArray[0];
    //this.logError(' value is : ' + value);
    return value;
  }

  /**
  * Takes raw temperature sensor reading from device and converts to temperature value in centigragde as a float.
  * @remarks: Conversion implementation is device specific.
  * @param rawTempReading: string
  * @param precision: number  denoting number of decimal points.
  * @return float
  */

  convertTemperatureToCentigrade(rawTempReading,precision){
    let tempInC = (+rawTempReading * (3300/4096) - 1562.2)/(-8.16);
    //round to 1 decimal point.
    let multiplier = Math.pow(10, precision || 0);
    return Math.round(tempInC * multiplier) / multiplier;
  }


  /**
  * round numbers to specific number of decimal points specified by precision

  * required in DataReaderService
  */

  roundNumber(value, precision) {
    var multiplier = Math.pow(10, precision || 0);
    return Math.round(value * multiplier) / multiplier;
  }



  /**
  *  Retrieve timezoneOffset for AnalysisPage
  *  @param date
  */

  public getTimezoneOffset(date:string){
    let query = "SELECT timezoneOffset from sensorData where date = date('" + date + "') limit 1";
    return this.database.executeSql(query, [])
    .then((data)=>{
      // this.logError('timezoneOffset Length is  ' + data.rows.length + ' Offset is ' + data.rows.item(0).timezoneOffset,'');
      return data.rows.item(0).timezoneOffset;

    },(error) =>{
      this.logError('Error getting timezoneOffset ',error);
      return null;
    });

  }


  getAveragedDataSet(averageOver,dataLength,dataArray,xAxisArray,commandArray,rLoadAndIntZArray,samplingSetupArray){
    let newDataArray = [];
    for (let i = 0; i < dataLength; i++) {
      i = i + (averageOver -1);
      let subArray = dataArray.slice((i-(averageOver-1)),i); //subarray of previous data with lenght from averageOver
      //enter the last date in the window being averaged.
      newDataArray.push(xAxisArray[i]
      + ',' +
      this.arrayAverage(subArray)
        + ', ,' + //TODO insert temperature here...
      commandArray[i]
      + ',' +
      rLoadAndIntZArray[i]
      + ',' +
      samplingSetupArray[i]
      + '\r\n'
      );

      if((dataLength - i)<= averageOver){
        //discard rest of data for now.
        break;
      }
    }
    this.logError('Printing avg array data length ',newDataArray.length);
    return newDataArray;
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
    // this.logError('printing sum ' + sum + ' ' + avg);
    return avg;
  }


  /*
  For downloading all data..
  */

  getRowCount(chartDateForQuery): Promise<number>{
    let count = 0;
    let query: string;
    if(chartDateForQuery == null){
      query = "Select count(*) as myCount from sensorData where user";
    }
    else{
      query = "Select count(*) as myCount from sensorData where date = date('" + chartDateForQuery + "')";
    }

    return this.database.executeSql(query,[])
    .then((rowCount)=>{
      this.logError('Database: Total no. of rows is ' + rowCount.rows.item(0).myCount + ' for ' + chartDateForQuery,'');
      count = rowCount.rows.item(0).myCount;
      return count;
    },(error) =>{
      this.logError('Error getting row count for all data in sensorData ',error);
      return count;
    });
  }




  /**
  * The date and time are stored as UTC
  */

  convertDatetoHHMMSS(convertDate){

		let date = new Date(convertDate);
    //this.logError('Data format for time ' + date.toUTCString());
    let mmString: string;
    let ssString: string;
    let mm = date.getUTCMinutes();
    let ss = date.getUTCSeconds();
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
    let hhmmssTime = date.getUTCHours() + ':' + mmString + ':' + ssString;
    //this.logError('time is ' + hhmmssTime);
    return hhmmssTime;
	}

  /**
  * The date and time are stored as UTC
  *
  */

  convertDatetoHHMMSSMS(convertDate){

		let date = new Date(convertDate);
    let mmString: string;
    let ssString: string;
    let msString: string;
    let mm = date.getUTCMinutes();
    let ss = date.getUTCSeconds();
    let ms = date.getUTCMilliseconds();
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
    if(ms < 10){
      msString = '00' + String(ms);
    }
    else if(ms < 100){
      msString = '0' + String(ms);
    }
    else{
      msString = String(ms);
    }
    let hhmmssTime = date.getUTCHours() + ':' + mmString + ':' + ssString + '.' + msString;
    return hhmmssTime;
	}

  /**
  * Return a date in required Excel format yyyy-mm-dd HH_MM_SS
  * @param timezoneOffset: number
  * @param chartDate - string (Date in ISO format)
  * @return string in the following format yyyy-mm-dd_HH_MM_SS
  */

  convertDatetoExcelFormat(timezoneOffset,chartDate){
    // this.logError('timezoneOffset ' + timezoneOffset,'');
    // this.logError('date in excel format conversion ' + chartDate,'');
    let timestamp = new Date(chartDate).getTime();
    let newTime = timestamp + (-timezoneOffset * 60000);
    let dateWithOffset = new Date(newTime);
    return this.convertDateToYYYYMMDD(dateWithOffset) + ' ' +this.convertDatetoHHMMSSMS(dateWithOffset);
  }
  /**
  *
  *  @param chartDate - string (Date in ISO format)
  */

  convertDateToExcelFormat_NoTimezoneoffset(chartDate){
    let date = new Date(chartDate);
    return this.convertDateToYYYYMMDD(date) + ' ' +this.convertDatetoHHMMSSMS(date);
  }

  //Date is converted to UTC string format for localStorage

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





  /**
  * Takes a device object (sensorDevice) and saves it to the local database if new and uses default JSON config of app as its deviceSetting.
  * @param device: {name:string, address:string, id:string macaddress of device. , class:class,userId:string}
  * @return a number - local database unique rowid for device.

  */

  async saveDevice(device): Promise<number>{
    try{
      let configuration = null;
      let foundDevice = await this.database.executeSql("SELECT * FROM sensorDevice where id ='" + device.id + "' and userId='" + device.userId + "'",[]);
      if(foundDevice.rows.length>0){

        let deviceReturned  = foundDevice.rows.item(0);
        this.logError('Device already in database: ' + deviceReturned.rowid,'');
        //load the correct configuration file.
        if(deviceReturned.configId != null){
          configuration = await this.getSelectedConfiguration(deviceReturned.configId);
        }

        if(configuration == null){
          //set default config that comes with the app.
          let newConfig = await this.saveDeviceConfig('default',JSON.stringify(this.SharedService.defaultConfig),device.userId,deviceReturned.rowid);
          await this.updateDeviceWithNewConfig(deviceReturned.rowid,newConfig.configId);

          this.SharedService.setDeviceConfigObj(newConfig);
          this.SharedService.setDeviceSetting(this.SharedService.defaultConfig);
          this.logError('Saving default config for device: ', this.SharedService.defaultConfig);
        }
        else{
          // this.logError('Device is associated with a config already: ',configuration);
          this.SharedService.setDeviceConfigObj(configuration);
          this.SharedService.setDeviceSetting(configuration.config);
        }
        return deviceReturned.rowid;
      }
      else{
        let query = "INSERT INTO sensorDevice (name, address, id, class,userId) VALUES (?,?,?,?,?)";
        let data = await this.database.executeSql(query,[device.name, device.address,device.id,device.class,device.userId]);
        this.logError('Device saved as new entry into database: ' + data.insertId,'');

        //set default config that comes with the app.
        let newConfig = await this.saveDeviceConfig('default',JSON.stringify(this.SharedService.defaultConfig),device.userId,data.insertId);
        await this.updateDeviceWithNewConfig(data.insertId,newConfig.configId);


        this.SharedService.setDeviceConfigObj(newConfig);
        this.SharedService.setDeviceSetting(this.SharedService.defaultConfig);
        return data.insertId;
      }
    }
    catch(error){
      this.logError('Error saving device to database.  ' ,error);
      throw error;
    }
  }

  /**
  @param user: {email:string, name: string, id:number}
  @return id: number - localdatabase id for user
  */

  async saveUserToLocalDatabase(user): Promise<number>{
    let query = "INSERT INTO user (email,name,remoteDbId) VALUES (?,?,?)";
    return this.database.executeSql("Select * from user where email = '" + user.email + "' and remoteDbId = '" + user.id + "'",[]).then((userInDb)=>{
      if (userInDb.rows.length == 0) {
        this.logError('Create local db entry for user: ' + user.email,'');
        return this.database.executeSql(query,[user.email, user.name,user.id])
        .then(data => {
          //this.logError(JSON.stringify(data),'');
          return data.insertId;

        }, (error) =>{
          this.logError('Error in INSERT user statement ' ,error);
          return error;
        });
      }
      else{
        this.logError('User in local db with rowid: ' + userInDb.rows.item(0).rowid,'');
        return userInDb.rows.item(0).rowid;
      }
    }, (error) =>{
      this.logError('Error getting user object from user table ' ,error);
      return error;
    });
  }


  /**
  * return a date in ISOstring format.
  */

  getDate(dateString){
    let today: Date = null;
		if(dateString == null){
			today = new Date();
    }
		else{
			today = new Date(dateString);
    }
		return today.toISOString(); // ?? or UTC
	}


  //ISO string time.

  convertDatetoHHMMSS_ISO (convertDate) {
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
    let hhmmssTime = date.getHours() + ':' + mmString + ':' + ssString;

    return hhmmssTime;
  }

  //Hack to create a date object in UTC format

  convertToUTCDate(databaseArray){
    const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    //get a UTC string.. 05 October 2011 14:48 UTC
    let dateArray = databaseArray[0].date.split('-');

    let a = dateArray[2] + ' ' + MONTH_NAMES[dateArray[1]-1] + ' ' + dateArray[0] + ' ' + databaseArray[0].time + ' UTC';

    return new Date(a);

  }

  /*
  * chart.js needs this format of date to display time in x axis.
  */

  reconstructISODate(date,time){

    //make a UTC date first.

    let utcDate = this.convertToUTCDate(this.hackConvertToUTCDate(date,time));
    let newDate = new Date(utcDate.toISOString());
    return newDate.toISOString();
  }



//make an array with one object in format {date:val,time:val}
  hackConvertToUTCDate(date,time){
    let array = [{date:date,time:time}];
    return array;
  }


  getDatabaseState() {
    if(this.databaseReady !== null && this.databaseReady !== undefined){
      return this.databaseReady.asObservable();
    }
    else{
      this.logError('Error in database service ','');
      return Observable.empty();
    }
  }

  logError(message,error){
    let errStackTrace = JSON.stringify(error,Object.getOwnPropertyNames(error));
    console.log('DatabaseService: ' + message + ' ' + errStackTrace);
    this.SharedService.saveForLog((new Date().toISOString() + ': DatabaseService: ').concat(message).concat(errStackTrace));
  }

  //******** DATABASE MODIFICATION *****//
  //Create tables needed for using Methods for experiments

  createMethodsTable(){
    return this.database.executeSql('CREATE TABLE IF NOT EXISTS methods(rowid INTEGER PRIMARY KEY, dateCreated TEXT,dateModified TEXT, name TEXT,deviceId INTEGER, userId INTEGER, numberOfPreconditions INTEGER, preconditionRepetition INTEGER,numberOfMeasures INTEGER, continuousMeasure BOOLEAN, measuresRepetition INTEGER, postMeasureSetContinuousVoltage BOOLEAN,unitOfCurrent STRING,timezoneOffset TEXT NOT NULL DEFAULT (0), FOREIGN KEY(deviceId) REFERENCES sensorDevice(rowid), FOREIGN KEY(userId) REFERENCES user(rowid))',{})
    .then(()=>{
      return this.database.executeSql('CREATE TABLE IF NOT EXISTS step(rowid INTEGER PRIMARY KEY, methodId INTEGER,gainDescription TEXT, gainCommand INTEGER, gainArrayIndex INTEGER, potentialDescription TEXT, potentialCommand INTEGER, potentialArrayIndex INTEGER,internalZeroDescription STRING, internalZeroArrayIndex INTEGER, loadResistorDescription TEXT, loadResistorArrayIndex INTEGER, rLoadWheelSelectorTitle TEXT,duration INTEGER, save BOOLEAN, dataFrequency INTEGER, zeroOffset INTEGER, scalingFactor INTEGER, isPrecondition INTEGER, stepNumber INTEGER,FOREIGN KEY(methodId) REFERENCES methods(rowid) )',{});
      //STEP COLUMN isPrecondition = 1 IF STEP IS A precondition and 0 if a measure.
    });
  }

  /**
  * Save a method for a specific user and device.
  * @param methodParam method object to be saved into the atabase.
  * @return methodParam
  * returns reference of same method object with updated properties, dateCreated,dateModified,databaseRowid
  * dates are returned as local formatted string.
  */

  async saveMethod(method: methodParam): Promise<methodParam>{

    try{
      let query = "INSERT INTO methods (name,dateCreated,dateModified,deviceId,userId,numberOfPreconditions,preconditionRepetition,numberOfMeasures,measuresRepetition,continuousMeasure,unitOfCurrent,postMeasureSetContinuousVoltage,timezoneOffset) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)";
      let date = new Date();
      if(method.dateCreated == null){
        method.dateCreated = method.dateModified = date.toISOString();
        method.dateModified_localString = date.toLocaleString();
      }
      else{
          method.dateModified = date.toISOString();
          method.dateModified_localString = date.toLocaleString();
      }

      let timezoneOffset = (new Date(method.dateCreated)).getTimezoneOffset();
      let insertedData = await this.database.executeSql(query,[method.name,method.dateCreated,method.dateModified,method.deviceId, method.userId,method.listOfPreconditions.length,method.preconditionRepetition,method.listOfMeasures.length,method.measuresRepetition,method.continuousMeasure,method.unitOfCurrent,method.postMeasureSetContinuousVoltage, timezoneOffset])

      method.databaseRowid = insertedData.insertId;

      let length = method.listOfPreconditions.length;
      let step;
      let stepNumber;
      for(let i=0;i<length;i++){
        stepNumber = i + 1;
        step = method.listOfPreconditions[i];
        insertedData = await this.database.executeSql('INSERT into step (methodId, gainDescription, gainCommand, gainArrayIndex,loadResistorDescription,loadResistorArrayIndex,potentialDescription, potentialCommand, potentialArrayIndex,internalZeroDescription, internalZeroArrayIndex,rLoadWheelSelectorTitle, duration,save,dataFrequency,zeroOffset, scalingFactor, isPrecondition,stepNumber) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [method.databaseRowid,step.gain.description,step.gain.command, step.gain.index,step.gain.rLoad.description, step.gain.rLoad.index, step.potential.description, step.potential.command, step.potential.index, step.potential.intZ.description, step.potential.intZ.index, step.rLoadWheelSelectorTitle,  step.duration, step.save, step.dataFrequency,step.zeroOffset, step.scalingFactor,1,stepNumber]);
        method.listOfPreconditions[i].stepNumber = stepNumber;
        method.listOfPreconditions[i].databaseRowid = insertedData.insertId;
        method.listOfPreconditions[i].methodId = method.databaseRowid;
      }

      length = method.listOfMeasures.length;
      for(let i=0;i<length;i++){
        stepNumber = i + 1;
        step = method.listOfMeasures[i];
        insertedData = await this.database.executeSql('INSERT into step (methodId, gainDescription, gainCommand, gainArrayIndex,loadResistorDescription,loadResistorArrayIndex, potentialDescription, potentialCommand, potentialArrayIndex,internalZeroDescription, internalZeroArrayIndex,rLoadWheelSelectorTitle, duration,save,dataFrequency,zeroOffset, scalingFactor, isPrecondition,stepNumber) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [method.databaseRowid,step.gain.description,step.gain.command, step.gain.index,step.gain.rLoad.description, step.gain.rLoad.index,step.potential.description, step.potential.command, step.potential.index, step.potential.intZ.description, step.potential.intZ.index, step.rLoadWheelSelectorTitle,step.duration, step.save,step.dataFrequency,step.zeroOffset, step.scalingFactor,0,stepNumber]);
        method.listOfMeasures[i].stepNumber = stepNumber;
        method.listOfMeasures[i].databaseRowid = insertedData.insertId;
        method.listOfMeasures[i].methodId = method.databaseRowid;
      }

      return method;
    }
    catch(err){
      throw err;
    }
  }
  /**
  * Removes old method and adds this method (dateCreated is retained)
  * @param methodParam
  * @return methodParam the reference to the updated method object is returned.
  */
  async updateMethod(method: methodParam): Promise<methodParam>{
    try{
      let oldDatabaseRowId = method.databaseRowid; //save this for deletion.
      let updatedMethod = await this.saveMethod(method);
      await this.deleteMethod(oldDatabaseRowId);
      return updatedMethod;
    }
    catch(error){
      this.logError('Error updating method',error);
      throw error;
    };

  }


  /**
  *
  * Gets a list of all methods saved by a user for current device.
  * @param unique userId and unique device Id
  * @param array of methodparam objects.
  */
  async getMethods(userId: number, deviceId: number): Promise<methodParam[]>{

    let length: number;
    let methodsArray: Array<methodParam> = [];


    let data = await this.database.executeSql("SELECT * FROM methods where userId='" + userId + "' AND deviceId='" + deviceId + "'", []);
    length = data.rows.length;
    // this.logError('methods - length ' + length,'');
    if ( length > 0) {
      for (let i = 0; i < length; i++) {
        let steps = await this.database.executeSql("Select * from step where methodId='" + data.rows.item(i).rowid + "'",[]);
        let lengthOfSteps = steps.rows.length;
        let preconditionsArray = [];
        let measuresArray = [];

        for(let j=0; j<lengthOfSteps; j++){
        let step = {
                    potential: { description: steps.rows.item(j).potentialDescription,
                                 command: steps.rows.item(j).potentialCommand,
                                 index: steps.rows.item(j).potentialArrayIndex,
                                 intZ: { description: steps.rows.item(j).internalZeroDescription,
                                        index: steps.rows.item(j).internalZeroArrayIndex
                                      }
                                },
                    gain: {     description: steps.rows.item(j).gainDescription,
                                 command: steps.rows.item(j).gainCommand,
                                 index: steps.rows.item(j).gainArrayIndex,
                                 rLoad: { description: steps.rows.item(j).loadResistorDescription,
                                        index: steps.rows.item(j).loadResistorArrayIndex
                                      }
                          },
                    save: steps.rows.item(j).save,
                    duration: steps.rows.item(j).duration,
                    dataFrequency: steps.rows.item(j).dataFrequency,
                    color: 'black',
                    rLoadWheelSelectorTitle: steps.rows.item(j).rLoadWheelSelectorTitle,
                    zeroOffset: steps.rows.item(j).zeroOffset,
                    scalingFactor: steps.rows.item(j).scalingFactor,
                    unitOfCurrent: steps.rows.item(j).unitOfCurrent,
                    databaseRowid: steps.rows.item(j).rowid,
                    stepNumber: steps.rows.item(j).stepNumber
          }
          if(steps.rows.item(j).isPrecondition == 1){
            preconditionsArray.push(step);
          }
          else{
            measuresArray.push(step);
          }
        }

        let method = {
                name: data.rows.item(i).name,
                // dateCreated: this.apply TimezoneOffset(data.rows.item(i).timezoneOffset,data.rows.item(i).dateCreated),
                // dateModified: this.apply TimezoneOffset(data.rows.item(i).timezoneOffset,data.rows.item(i).dateModified),
                dateCreated: data.rows.item(i).dateCreated,
                dateModified: data.rows.item(i).dateModified,
                dateModified_localString: (new Date(data.rows.item(i).dateModified)).toLocaleString(),
                deviceId: data.rows.item(i).deviceId,
                listOfPreconditions: preconditionsArray,
                preconditionRepetition: data.rows.item(i).preconditionRepetition,
                listOfMeasures: measuresArray,
                measuresRepetition: data.rows.item(i).measuresRepetition,
                continuousMeasure: data.rows.item(i).continuousMeasure,
                postMeasureSetContinuousVoltage: data.rows.item(i).postMeasureSetContinuousVoltage,
                unitOfCurrent: data.rows.item(i).unitOfCurrent,
                databaseRowid: data.rows.item(i).rowid,
                userId: data.rows.item(i).userId
              }
        methodsArray.push(method);
      }
      return methodsArray;
    }
    else{
      return [];
    }
  }

  /**
  *  A method object of type methodParam is created from the database record matching the param rowid
  * @param rowid: number rowid of method.
  * @return null or methodParam is returned
  */

  async getChosenMethod(rowid: number): Promise<methodParam>{

    let data = await this.database.executeSql("SELECT * FROM methods where rowid=" + rowid, []);
    let length = data.rows.length;
  //  this.logError('printing method from database. ' + JSON.stringify(data.rows.item(0)),'');
    if ( length > 0) {
      let steps = await this.database.executeSql("SELECT * FROM step WHERE methodId='" + data.rows.item(0).rowid + "' ORDER BY rowid ASC ",[]);
      let lengthOfSteps = steps.rows.length;

      let preconditionsArray = [];
      let measuresArray = [];
      for(let j=0; j<lengthOfSteps; j++){
        let stepRef = steps.rows.item(j);
        let save = (stepRef.save == 'true');
        let step = {
                  potential: { description: stepRef.potentialDescription,
                               command: stepRef.potentialCommand,
                               index: stepRef.potentialArrayIndex,
                               intZ: { description: stepRef.internalZeroDescription,
                                      index: stepRef.internalZeroArrayIndex
                                    }
                              },
                  gain: {     description: stepRef.gainDescription,
                               command: stepRef.gainCommand,
                               index: stepRef.gainArrayIndex,
                               rLoad: { description: stepRef.loadResistorDescription,
                                      index: stepRef.loadResistorArrayIndex
                                    }
                        },
                  save: save,
                  duration: stepRef.duration,
                  dataFrequency: stepRef.dataFrequency,
                  color: 'black',
                  rLoadWheelSelectorTitle: stepRef.rLoadWheelSelectorTitle,
                  zeroOffset: stepRef.zeroOffset,
                  scalingFactor: stepRef.scalingFactor,
                  unitOfCurrent: stepRef.unitOfCurrent,
                  databaseRowid: stepRef.rowid,
                  stepNumber: stepRef.stepNumber
        }
        if(stepRef.isPrecondition == 1){
          // console.log('Step added to precondition: ' + JSON.stringify(stepRef,null,4));
          preconditionsArray.push(step);
        }
        else{
          // console.log('Step added to measure: ' + JSON.stringify(stepRef,null,4));
          measuresArray.push(step);
        }
      }
      let continuousMeasure = (data.rows.item(0).continuousMeasure == 'true');
      let postMeasureSetContinuousVoltage = (data.rows.item(0).postMeasureSetContinuousVoltage == 'true');
      let method = {
              name: data.rows.item(0).name,
              dateCreated: data.rows.item(0).dateCreated,
              dateModified: data.rows.item(0).dateModified,
              dateModified_localString: (new Date(data.rows.item(0).dateModified)).toLocaleString(),
              // dateCreated: (new Date(data.rows.item(0).dateCreated)).toLocaleString(),
              // dateModified: (new Date(data.rows.item(0).dateModified)).toLocaleString(),
              // dateCreated: this.apply TimezoneOffset(data.rows.item(0).timezoneOffset,data.rows.item(0).dateCreated),
              // dateModified: this.apply TimezoneOffset(data.rows.item(0).timezoneOffset,data.rows.item(0).dateModified),
              deviceId: data.rows.item(0).deviceId,
              listOfPreconditions: preconditionsArray,
              preconditionRepetition: data.rows.item(0).preconditionRepetition,
              listOfMeasures: measuresArray,
              measuresRepetition: data.rows.item(0).measuresRepetition,
              continuousMeasure: continuousMeasure,
              postMeasureSetContinuousVoltage: postMeasureSetContinuousVoltage,
              unitOfCurrent: data.rows.item(0).unitOfCurrent,
              databaseRowid: data.rows.item(0).rowid,
              userId: data.rows.item(0).userId
            };
      return method;
    }
    else{
      return null;
    }
  }

  /**
  * Get a method for a given experiment using unique rowid passed as a parameter. .
  * @param rowid - unique number for method.
  * @return methodParam object or null if rowid not present in the table.
  */

  async getChosenExperimentMethod(rowid: number): Promise<methodParam>{

    let length: number;

    let data = await this.database.executeSql("SELECT * FROM experimentMethod where rowid=" + rowid, []);
    length = data.rows.length;
    this.logError('Experimentmethod retrieved with length: ' + length,'');
    if ( length > 0) {
      let steps = await this.database.executeSql("SELECT * FROM experimentStep WHERE methodId='" + data.rows.item(0).rowid + "' ORDER BY rowid ASC ",[]);
      let lengthOfSteps = steps.rows.length;

      let preconditionsArray = [];
      let measuresArray = [];
      for(let j=0; j<lengthOfSteps; j++){
        let stepRef = steps.rows.item(j);
        let save = (stepRef.save == 'true');
        let step = {
                  potential: { description: stepRef.potentialDescription,
                               command: stepRef.potentialCommand,
                               index: stepRef.potentialArrayIndex,
                               intZ: { description: stepRef.internalZeroDescription,
                                      index: stepRef.internalZeroArrayIndex
                                    }
                              },
                  gain: {     description: stepRef.gainDescription,
                               command: stepRef.gainCommand,
                               index: stepRef.gainArrayIndex,
                               rLoad: { description: stepRef.loadResistorDescription,
                                      index: stepRef.loadResistorArrayIndex
                                    }
                        },
                  save: save,
                  duration: stepRef.duration,
                  dataFrequency: stepRef.dataFrequency,
                  color: 'black',
                  rLoadWheelSelectorTitle: stepRef.rLoadWheelSelectorTitle,
                  zeroOffset: stepRef.zeroOffset,
                  scalingFactor: stepRef.scalingFactor,
                  unitOfCurrent: stepRef.unitOfCurrent,
                  databaseRowid: stepRef.rowid,
                  stepNumber: stepRef.stepNumber
        }

        if(stepRef.isPrecondition == 1){
          // console.log('Step added to precondition: ' + JSON.stringify(stepRef,null,4));
          preconditionsArray.push(step);
        }
        else{
          // console.log('Step added to measure: ' + JSON.stringify(stepRef,null,4));
          measuresArray.push(step);
        }
      }
      let continuousMeasure = (data.rows.item(0).continuousMeasure == 'true');
      let postMeasureSetContinuousVoltage = (data.rows.item(0).postMeasureSetContinuousVoltage == 'true');
      let method = {
              name: data.rows.item(0).name,
              dateCreated: data.rows.item(0).dateCreated,
              dateModified: data.rows.item(0).dateModified,
              dateModified_localString: (new Date(data.rows.item(0).dateModified)).toLocaleString(),
              // dateCreated: (new Date(data.rows.item(0).dateCreated)).toLocaleString(),
              // dateModified: (new Date(data.rows.item(0).dateModified)).toLocaleString(),
              // dateCreated: this.apply TimezoneOffset(data.rows.item(0).timezoneOffset,data.rows.item(0).dateCreated),
              // dateModified: this.apply TimezoneOffset(data.rows.item(0).timezoneOffset,data.rows.item(0).dateModified),
              deviceId: data.rows.item(0).deviceId,
              listOfPreconditions: preconditionsArray,
              preconditionRepetition: data.rows.item(0).preconditionRepetition,
              listOfMeasures: measuresArray,
              measuresRepetition: data.rows.item(0).measuresRepetition,
              continuousMeasure: continuousMeasure,
              postMeasureSetContinuousVoltage: postMeasureSetContinuousVoltage,
              unitOfCurrent: data.rows.item(0).unitOfCurrent,
              databaseRowid: data.rows.item(0).rowid,
              userId: data.rows.item(0).userId
            };
      return method;
    }
    else{
      return null;
    }
  }


  /**
  * List of method names with unique ids prepared
  * @param userId: number
  * @param deviceId: number
  * @return array of object of type {description: string, databaseRowid: number, dateCreated:string}
  */

  async getListOfMethodNames(userId: number, deviceId: number): Promise<{description: string, databaseRowid: number, dateCreated:string}[]>{
    let length: number;
      let methodNamesArray: {description: string, databaseRowid: number,dateCreated:string}[] = [];
      let data = await this.database.executeSql("SELECT rowid,name,dateModified,timezoneOffset FROM methods where userId=" + userId + " AND deviceId=" + deviceId + " ORDER BY rowid DESC ", []);
      length = data.rows.length;
      // this.logError('methods - length ' + length,'');
      if ( length > 0) {
        for (let i = 0; i < length; i++) {
          let method = {
                  description: data.rows.item(i).name,
                  databaseRowid: data.rows.item(i).rowid,
                  dateCreated:(new Date(data.rows.item(i).dateModified)).toLocaleString(),

                  //dateCreated:this.apply TimezoneOffset(data.rows.item(i).timezoneOffset,data.rows.item(i).dateCreated)
                };
          methodNamesArray.push(method);
        }

        return methodNamesArray;
      }
      else{
        return methodNamesArray;
      }
  }

  /**
  * Delete a method and its associated steps from the database.
  */
  async deleteMethod(databaseRowid: number): Promise<void>{
    try {
      await this.database.executeSql("DELETE from step where methodId=" + databaseRowid ,[]);
      await this.database.executeSql("DELETE FROM methods where rowid=" + databaseRowid, []);
    }
    catch(err){
      throw err;
    }
  }


  /**
  * since configuration details are stored as a text value, there is a max limit.
  */
  async createDeviceConfigTable(){
    try{
      await this.database.executeSql("CREATE TABLE IF NOT EXISTS deviceConfig(rowid INTEGER PRIMARY KEY, dateCreated TEXT, name TEXT, timezoneOffset TEXT NOT NULL DEFAULT (0), config TEXT, userId INTEGER, deviceId INTEGER,FOREIGN KEY(userId) REFERENCES user(rowid),FOREIGN KEY(deviceId) REFERENCES sensorDevice(rowid))",{});
    }
    catch(err){
      throw err;
    }

  }

  /**
  * Update existing sensorDevice record with a new configId pointing to new config
  */
  async updateDeviceWithNewConfig(deviceId: number,configId: number){
    try{
      let query = "UPDATE sensorDevice set configId=? WHERE rowid=" +  deviceId;
      await this.database.executeSql(query,[configId]);
    }
    catch(error){
      this.logError('Could not update device record with chosen configId','');
      throw error;
    }

  }

  /**
  * Saves config JSON object (as string) with date, device id and user id  into local database.
  * @param name: name of config as string
  * @param deviceSettingAsString : configJSON obj as string.
  * @return deviceConfigDBParams to store in memory and local storage (SharedService)
  */

  async saveDeviceConfig(name,deviceSettingAsString,userId,deviceId): Promise<deviceConfigDBParams>{

    try{
      let query = "INSERT INTO deviceConfig (name,dateCreated,deviceId,timezoneOffset,userId,config) VALUES (?,?,?,?,?,?)";
      let date = new Date();
      let dateCreated = date.toISOString();
      let timezoneOffset = date.getTimezoneOffset();
      let insertedData = await this.database.executeSql(query,[name,dateCreated,deviceId,timezoneOffset,userId,deviceSettingAsString]);
      let configuration: deviceConfigDBParams  = {
        configId: insertedData.insertId,
        name: name,
        dateCreated: date.toLocaleString(),
        config:JSON.parse(deviceSettingAsString)
      };
      return configuration;
    }
    catch(err){
      throw err;
    }
  }

  /**
  * Update an existing config record with new data.
  * @param name: userdefined name
  * @param deviceConfig - user defined config object as string. (should already be validated as json object jsonConfig )
  */

  async updateDeviceConfig(name:string,deviceConfig:string,configId:number): Promise<void>{
    try{
      let query = "UPDATE deviceConfig set name=?, config=? WHERE rowid=?";
      await this.database.executeSql(query,[name,deviceConfig,configId]);
    }
    catch(error){
      throw error;
    }

  }

  /**
  *  Check if config is linked to any device in the database for a user before deleting it
  *  @param configId to be deleted
  *  @param userId currently logged user id.
  */

  async deleteDeviceConfig(configId: number,userId:number): Promise<void>{
    try{
      let query = "SELECT configId from sensorDevice WHERE userId=? AND configId=?";
      let returnedData = await this.database.executeSql(query,[userId,configId]);
      if(returnedData.rows.length > 0){
        throw Error('Cannot delete a configuration that is linked to a device');
      }
      query = "DELETE from deviceConfig where rowid=?";
      await this.database.executeSql(query,[configId]);

    }
    catch(err){
      throw err;
    }
  }

  /**
  * Return a list of configurations saved by current user - without the configJSON object .
  * Will return ALL CONFIGS for all devices used.- may not match the current device.
  * @param id of current user.
  */
  async getListOfConfigurations(userId: number): Promise<deviceConfigDBParams[]>{
    try{
      let length: number;
        let configurations: deviceConfigDBParams[] = [];
        configurations.push({name: 'default', configId: 0,dateCreated: '',config: null})
        let data = await this.database.executeSql("SELECT rowid,name,dateCreated,timezoneOffset FROM deviceConfig where userId=" + userId + " ORDER BY rowid DESC ", []);
        length = data.rows.length;
        //this.logError('experiments array length ' + length,'');
        if ( length > 0) {
          for (let i = 0; i < length; i++) {
            let configuration = {
                    name: data.rows.item(i).name,
                    configId: data.rows.item(i).rowid,
                    dateCreated: (new Date(data.rows.item(i).dateCreated)).toLocaleString(),
                    config: null
                    //dateCreated:this.apply TimezoneOffsetToLocaleString(data.rows.item(i).timezoneOffset,data.rows.item(i).dateCreated)
                  };

            configurations.push(configuration);
          }

          return configurations;
        }
        else{
          return configurations;
        }
      }
      catch(err){
        throw err;
      }
  }

  /**
  * Returns an object with JSON config object for device settings. Returns null if the configId does not exist in
  * the database.
  * @param configId: number - is the unique rowid of the record.
  * @return null or {configId: number, name: string, config: configJSON, dateCreated: string as localestring};
  */

  async getSelectedConfiguration(configId: number): Promise<deviceConfigDBParams>{
    let query;
    let configuration: deviceConfigDBParams = {configId: null, name: null, config: null, dateCreated: null};

    if(configId == null){
      throw Error('Configuration id cannot be null');
    }
    else{
      query = "SELECT rowid, name,dateCreated,timezoneOffset, config from deviceConfig where rowid =" + configId;
      this.logError('Selecting for configId ' + configId,'');
    }

    if (this.tablesCreated){
      try{
        let data = await this.database.executeSql(query, []);
        if(data.rows.length == 0){
          throw Error('Requested config was not found in the database');
        }
        else{
          configuration.configId = data.rows.item(0).rowid;
          configuration.name = data.rows.item(0).name;
          configuration.config = JSON.parse(data.rows.item(0).config);
          configuration.dateCreated = (new Date(data.rows.item(0).dateCreated)).toLocaleString();
          //configuration.dateCreated = this.apply TimezoneOffset(data.rows.item(0).timezoneOffset,data.rows.item(0).dateCreated);
          return configuration;
        }
      }
      catch(err){
        throw err;
      }
    }
    else{
      this.SharedService.presentAlert('Error','Local storage is not functioning as expected! App will fail! Error Code:GLEDe','Dismiss');
    }
  }

  /**
  *  Check if a device added by a user has a configuration object with required deviceSetting properties.
  *
  */

  async getConfigForDevice(deviceId: number,userId:number){
    let query;
    let configuration:deviceConfigDBParams = {configId: null, name: null, config: null, dateCreated: null};

    if(deviceId == null){
      throw Error('Device id cannot be null');
    }
    else if(userId == null){
      throw Error('User id cannot be null');
    }
    else{
      query = "SELECT rowid, name,dateCreated,timezoneOffset, config from deviceConfig where deviceId =" + deviceId + " AND userId=" + userId;
    }

    if (this.tablesCreated){
      try{
        let data = await this.database.executeSql(query, []);
        //this.logError('number of rows obtained ' + data.rows.length,'');
        if(data.rows.length == 0){
          return null;
        }
        else{
          configuration.configId = data.rows.item(0).rowid;
          configuration.name = data.rows.item(0).name;
          configuration.config = JSON.parse(data.rows.item(0).config);
          configuration.dateCreated = data.rows.item(0).dateCreated;
          //configuration.dateCreated = this.apply TimezoneOffset(data.rows.item(0).timezoneOffset,data.rows.item(0).dateCreated);
          return configuration;
        }
      }
      catch(err){
        this.logError('Could not get config for deviceId and userId ' + deviceId + ' ' + userId,err);
        throw err;
      }
    }
    else{
      alert('Local storage is not functioning as expected! App will fail! Error Code:GLEDe');
    }
  }

  /**
  * Called when app is installed to create tables required for storing experiment details.
  *
  */
  async createExperimentTable(){
    try{
      await this.database.executeSql('CREATE TABLE IF NOT EXISTS experiments(rowid INTEGER PRIMARY KEY, dateCreated TEXT, name TEXT, timezoneOffset TEXT NOT NULL DEFAULT (0), methodId INTEGER, postProcessingParamsId INTEGER, userId INTEGER,  FOREIGN KEY(methodId) REFERENCES experimentMethod(rowid),  FOREIGN KEY(postProcessingParamsId) REFERENCES postProcessingParams(rowid),FOREIGN KEY(userId) REFERENCES user(rowid))',{});
      await this.database.executeSql('CREATE TABLE IF NOT EXISTS experimentMethod(rowid INTEGER PRIMARY KEY, dateCreated TEXT,dateModified TEXT, name TEXT,deviceId INTEGER, userId INTEGER, numberOfPreconditions INTEGER, preconditionRepetition INTEGER,numberOfMeasures INTEGER, continuousMeasure BOOLEAN, measuresRepetition INTEGER, postMeasureSetContinuousVoltage BOOLEAN,unitOfCurrent STRING,timezoneOffset TEXT NOT NULL DEFAULT (0), FOREIGN KEY(deviceId) REFERENCES sensorDevice(rowid), FOREIGN KEY(userId) REFERENCES user(rowid))',{});
      await this.database.executeSql('CREATE TABLE IF NOT EXISTS experimentStep(rowid INTEGER PRIMARY KEY, methodId INTEGER,gainDescription TEXT, gainCommand INTEGER, gainArrayIndex INTEGER, potentialDescription TEXT, potentialCommand INTEGER, potentialArrayIndex INTEGER,internalZeroDescription STRING, internalZeroArrayIndex INTEGER, loadResistorDescription TEXT, loadResistorArrayIndex INTEGER, rLoadWheelSelectorTitle TEXT,duration INTEGER, save BOOLEAN, dataFrequency INTEGER, zeroOffset INTEGER, scalingFactor INTEGER,stepNumber INTEGER, isPrecondition INTEGER, FOREIGN KEY(methodId) REFERENCES experimentMethod(rowid) )',{});
        //STEP COLUMN isPrecondition = 1 IF STEP IS A precondition and 0 if a measure.
    }
    catch(err){
      throw err;
    }

  }

  /**
  * Create a copy of the method in experimentMethod and create a new record for an experiment.
  * @param name: string, name of experiment
  * @param method: methodParam  method to be used for the experiment
  * @param postProcessingParamsId: number identifying postProcessingParams containing object to use for this experiment.
  * @return rowid - unique id for experiment
  */



  async createNewExperiment(name,method,postProcessingParamsId): Promise<number>{


    let expMethod = await this.saveExperimentMethod(method); //copy of method made and updated with new rowid.

    let query = "INSERT INTO experiments (name,dateCreated,methodId,timezoneOffset,postProcessingParamsId,userId) VALUES (?,?,?,?,?,?)";
    let date = new Date();
    let dateCreated = date.toISOString();
    let timezoneOffset = date.getTimezoneOffset();

    let insertedData = await this.database.executeSql(query,[name,dateCreated,expMethod.databaseRowid,timezoneOffset,postProcessingParamsId,expMethod.userId]);

    return insertedData.insertId;
  }


  async saveExperimentMethod(method: methodParam): Promise<methodParam>{
    let query = "INSERT INTO experimentMethod (name,dateCreated,dateModified,deviceId,userId,numberOfPreconditions,preconditionRepetition,numberOfMeasures,measuresRepetition,continuousMeasure,unitOfCurrent,postMeasureSetContinuousVoltage,timezoneOffset) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)";
    if(method.dateCreated == null){
      method.dateCreated = method.dateModified = (new Date()).toISOString();
    }
    else{
      method.dateModified = (new Date()).toISOString();
    }
    let timezoneOffset = (new Date(method.dateCreated)).getTimezoneOffset();
    let insertedData = await this.database.executeSql(query,[method.name,method.dateCreated,method.dateModified,method.deviceId, method.userId,method.listOfPreconditions.length,method.preconditionRepetition,method.listOfMeasures.length,method.measuresRepetition,method.continuousMeasure,method.unitOfCurrent,method.postMeasureSetContinuousVoltage, timezoneOffset])

    method.databaseRowid = insertedData.insertId;

    let length = method.listOfPreconditions.length;
    let step;
    for(let i=0;i<length;i++){
      step = method.listOfPreconditions[i];
      insertedData = await this.database.executeSql('INSERT into experimentStep (methodId, gainDescription, gainCommand, gainArrayIndex,loadResistorDescription,loadResistorArrayIndex,potentialDescription, potentialCommand, potentialArrayIndex,internalZeroDescription, internalZeroArrayIndex,rLoadWheelSelectorTitle, duration,save,dataFrequency,zeroOffset, scalingFactor, stepNumber,isPrecondition) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [method.databaseRowid,step.gain.description,step.gain.command, step.gain.index,step.gain.rLoad.description, step.gain.rLoad.index, step.potential.description, step.potential.command, step.potential.index, step.potential.intZ.description, step.potential.intZ.index, step.rLoadWheelSelectorTitle,  step.duration, step.save, step.dataFrequency,step.zeroOffset, step.scalingFactor,step.stepNumber,1]);

      method.listOfPreconditions[i].databaseRowid = insertedData.insertId;
      method.listOfPreconditions[i].methodId = method.databaseRowid;
    }

    length = method.listOfMeasures.length;
    for(let i=0;i<length;i++){
      step = method.listOfMeasures[i];
      insertedData = await this.database.executeSql('INSERT into experimentStep (methodId, gainDescription, gainCommand, gainArrayIndex,loadResistorDescription,loadResistorArrayIndex, potentialDescription, potentialCommand, potentialArrayIndex,internalZeroDescription, internalZeroArrayIndex,rLoadWheelSelectorTitle, duration,save,dataFrequency,zeroOffset, scalingFactor, stepNumber,isPrecondition) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [method.databaseRowid,step.gain.description,step.gain.command, step.gain.index,step.gain.rLoad.description, step.gain.rLoad.index,step.potential.description, step.potential.command, step.potential.index, step.potential.intZ.description, step.potential.intZ.index, step.rLoadWheelSelectorTitle,step.duration, step.save,step.dataFrequency,step.zeroOffset, step.scalingFactor,step.stepNumber,0]);

      method.listOfMeasures[i].databaseRowid = insertedData.insertId;
      method.listOfMeasures[i].methodId = method.databaseRowid;
    }
    // this.logError('Printing experimentmethod after updating with insertids ' + JSON.stringify(method),'');
    return method;
  }


  /**
  * Get a list of all experiments recorded by the logged in user.
  * @param userId unique user id of user.
  * @return array of experiment objects {name,experimentId,dateCreated,postProcessingParamsId}
  */
  async getListOfExperiments(userId: number): Promise<{name: string, experimentId: number,dateCreated: string,postProcessingParamsId: number}[]>{

    let length: number;
      let experiments: {name: string, experimentId: number,dateCreated: string,postProcessingParamsId: number}[] = [];
      //let data = await this.database.executeSql("SELECT rowid,name,dateCreated,timezoneOffset FROM experiments where userId=" + userId, []);
      let data = await this.database.executeSql("SELECT rowid,name,dateCreated,timezoneOffset,postProcessingParamsId FROM experiments where userId=" + userId, []);
      length = data.rows.length;
      this.logError('No. of experiments in database: ' + length,'');
      if ( length > 0) {
        for (let i = 0; i < length; i++) {
          let experiment = {
                  name: data.rows.item(i).name,
                  experimentId: data.rows.item(i).rowid,
                  dateCreated: (new Date(data.rows.item(i).dateCreated)).toLocaleString(),
                  postProcessingParamsId: data.rows.item(i).postProcessingParamsId
                };

          experiments.push(experiment);
        }
        return experiments;
      }
      else{
        this.logError('No. of experiments in database: '+ length,'');
        return experiments;
      }
  }



    /**
    * Delete an experiment from the database.
    * @param experimentId Unique id of experiment to be deleted.
    */
    async deleteExptFromDatabase(experimentId){
      let query = "SELECT methodId from experiments where rowid =?";
      try {
        let data = await this.database.executeSql(query, [experimentId]);
        let methodId = data.rows.item(0).methodId;
        query = "Delete from experiments where rowid = ?";

        await this.database.executeSql(query, [experimentId]);
        query = "Delete from sensorData where experimentId = ?"
        await this.database.executeSql(query, [experimentId]);
        query = "Delete from experimentMethod where rowid = ?"
        await this.database.executeSql(query, [methodId]);
        query = "Delete from experimentStep where methodId = ?"
        await this.database.executeSql(query, [methodId]);
      }
      catch(error){
        this.logError('Error deleting rowid : ' + experimentId, '');
        throw error;
      }
    }

  /**
  * Returns object {experimentId: number, name: string, count: number, method: methodParam,dateCreated: string};
  * @param rowid of experiments table. This can be null. In which case, the last entered experiment is obtained.

  */

  async getExperimentDetails(experimentId):Promise<{experimentId: number, name: string, count: number, method: methodParam,dateCreated: string,postProcessingParamsId:number}>{
    let query;// = "SELECT rowid,methodId from experiments where rowid = (SELECT max(rowid) from experiments)";
    let experimentDetails = {experimentId: null, name: null, count: null, method: null,dateCreated: null,postProcessingParamsId: null};

    if(experimentId == null){
      query = "SELECT rowid,methodId,name,dateCreated,timezoneOffset,postProcessingParamsId from experiments where rowid = (SELECT max(rowid) from experiments)";
      this.logError('Selecting last entered experiment ','');
    }
    else{
      query = "SELECT rowid,methodId, name,dateCreated,timezoneOffset,postProcessingParamsId from experiments where rowid =" + experimentId;
      this.logError('Selecting for experimentId ' + experimentId,'');
    }

    if (this.tablesCreated){
      try{
        let data = await this.database.executeSql(query, []);
        //this.logError('number of rows obtained ' + data.rows.length,'');
        if(data.rows.length == 0){
          return experimentDetails;
        }
        else{
          experimentDetails.experimentId = data.rows.item(0).rowid;
          experimentDetails.name = data.rows.item(0).name;
          query = "Select count(*) as myCount from sensorData where experimentId=" + experimentDetails.experimentId;

          let rowCount = await this.database.executeSql(query,[]);
          experimentDetails.count = rowCount.rows.item(0).myCount;

          experimentDetails.method = await this.getChosenExperimentMethod(data.rows.item(0).methodId);
          //experimentDetails.dateCreated = this.apply TimezoneOffset(data.rows.item(0).timezoneOffset,data.rows.item(0).dateCreated);
          experimentDetails.dateCreated = (new Date(data.rows.item(0).dateCreated).toLocaleString());
        //  this.logError('database: data.rows.item(0).postProcessingParamsId: ' + data.rows.item(0).postProcessingParamsId,'');
          experimentDetails.postProcessingParamsId = data.rows.item(0).postProcessingParamsId;
          return experimentDetails;
        }
      }
      catch(err){

        throw err;
      }
    }
    else{
      alert('Local storage is not functioning as expected! App will fail! Error Code:GLEDe');
    }
  }
  /**
  * Takes a unique exeriment id (database row id) and retrieves data using the page size and offset provided
  * @param experimentId: number Is the unique database row id pointing to an experiment.
  * @param pageSize: number Value to set as limit in sql SELECT QUERY
  * @param offset: number Value to set as offset in sql SELECT QUERY
  */
  getExperimentData(experimentId,pageSize,offset): Promise<experimentDataObject>{

    let query = "SELECT data,current,stepNumber,chartDate,timezoneOffset,temperature,noOfMeasurementsPerStep,stepStartTime from sensorData where experimentId=" + experimentId + " limit " + pageSize +" OFFSET " + offset;
    let length = 0;


    //this.logError('Start time for getting data for one day ' + new Date());
    let dataForOneDay: experimentDataObject = { length: length,
                          dataArray: [],
                          chartDateArray: [],
                          currentArray: [],
                          stepIdArray: [],
                          temperatureArray: [],
                          noOfMeasurementsPerStepArray: [],
                          stepStartTimeArray: [],
                          experimentId: experimentId,
                          method: null
                        };

    if (this.tablesCreated) {
      //this.logError('The Memory before sql is: ' + this.extendedDeviceInformation.memory);

      return this.database.executeSql(query, [])
      .then((data) => {
        //this.logError('The Memory after sql is: ' + this.extendedDeviceInformation.memory);
        length = data.rows.length;
        this.logError('getExperimentData: No. of sensorData rows: ' + length,'');
        if (length > 0) {

          let stepRef;

          for (var i = 0; i < length; i++) {
            stepRef = data.rows.item(i);
            dataForOneDay.dataArray.push(stepRef.data);
            dataForOneDay.currentArray.push(stepRef.current);

            // dataForOneDay.chartDateArray.push(this.apply TimezoneOffset(stepRef.timezoneOffset,stepRef.chartDate));

            dataForOneDay.chartDateArray.push(stepRef.chartDate);
            // currentIArray.push(((dataArray[i] as any) - (stepRef.zeroOffset as any) ) * (stepRef.scalingFactor as any));
            dataForOneDay.stepIdArray.push(stepRef.stepNumber);
            dataForOneDay.temperatureArray.push(stepRef.temperature);
            dataForOneDay.noOfMeasurementsPerStepArray.push(stepRef.noOfMeasurementsPerStep);
            // dataForOneDay.stepStartTimeArray.push(this.apply TimezoneOffset(stepRef.timezoneOffset,stepRef.stepStartTime));
            dataForOneDay.stepStartTimeArray.push(stepRef.stepStartTime);
          }
          dataForOneDay.length = length;

          return dataForOneDay;
        }else{
          return dataForOneDay;
        }
      },(error) => {
        this.logError('Error getting data for one day : ',error);
        throw error;
      });
    }else{
      this.logError("Sqlite database is not ready",'');
      alert('Local storage could not be accessed at this time!');
    }
  }

  /**
  * Create table to save calibration experiments
  *
  *
  */
  async createCalibrationTable(){
    try{
      await this.database.executeSql('CREATE TABLE IF NOT EXISTS calibrations(rowid INTEGER PRIMARY KEY, dateCreated TEXT, name TEXT, timezoneOffset TEXT NOT NULL DEFAULT (0), concentration REAL, offset REAL,sensitivity REAL, algorithmDescription TEXT, unit TEXT, userId INTEGER,  deviceId INTEGER, FOREIGN KEY(userId) REFERENCES user(rowid),FOREIGN KEY(deviceId) REFERENCES sensorDevice(rowid))',{});
      await this.database.executeSql('CREATE TABLE IF NOT EXISTS calibrationData(rowid INTEGER PRIMARY KEY, date TEXT,data TEXT, timezoneOffset TEXT NOT NULL DEFAULT (0),stepStartTime TEXT, stepId INTEGER, noOfMeasurementsPerStep INTEGER,calibId,FOREIGN KEY(stepId) REFERENCES experimentStep(rowid), FOREIGN KEY(calibId) REFERENCES calibrations(rowid))',{});
    }
    catch(err){
      throw err;
    }
  }

  /**
  * Save data
  *
  */
  async createNewCalibration(calib): Promise<calibrationObj>{
  //async createNewCalibration(name:string,concentration: number,offset:number,unit:string,algorithmDescription:string,userId:number, deviceId:number,sensitivity:number): Promise<calibrationObj>{
    try{
      let query = " INSERT INTO calibrations (name,dateCreated,timezoneOffset,concentration,offset,sensitivity,unit,algorithmDescription,userId,deviceId) VALUES (?,?,?,?,?,?,?,?,?,?)";
      let date = new Date();
      let dateCreated = date.toISOString();
      let timezoneOffset = date.getTimezoneOffset();


      let insertedData = await this.database.executeSql(query,[calib.name,dateCreated,timezoneOffset,calib.concentration,calib.offset,calib.sensitivity,calib.unit,calib.algorithmDescription,calib.userId,calib.deviceId]);

      calib.dateCreated = dateCreated;
      calib.calibId = insertedData.insertId;
      return calib;

    }
    catch(err){
      throw err;
    }
  }

  /**
  * Update calibration table with sensitivity and offset.
  *
  */

  async updateCalibration(sensitivity: number, offset: number, calibId){
    try{
      let query = "Update calibrations set sensitivity=?, offset=? where rowid=?";
      await this.database.executeSql(query, [sensitivity,offset,calibId]);
    }
    catch(err){
      throw err;
    }
  }


  async getListOfCalibrations(userId: number,deviceId): Promise<calibrationObj[]>{
    try{
      let length: number;
      let calibrations: calibrationObj[] = [];
      let data = await this.database.executeSql("SELECT rowid,name,dateCreated,timezoneOffset,offset,sensitivity,concentration,unit FROM calibrations where userId=" + userId + " AND deviceId=" + deviceId + " ORDER BY rowid DESC ", []);
      length = data.rows.length;
      //this.logError('calibrations array length ' + length,'');
      if ( length > 0) {
        for (let i = 0; i < length; i++) {
          let row = data.rows.item(i);
          let calibration = {
                  name: row.name,
                  calibId: row.rowid,
                  dateCreated:(new Date(row.dateCreated)).toLocaleString(),
                  offset: row.offset,
                  sensitivity: row.sensitivity,
                  concentration: row.concentration,
                  unit: row.unit
                  // this.applyTime zoneOffsetToLocaleString(data.rows.item(i).timezoneOffset,data.rows.item(i).dateCreated)
                };
          //this.logError('calib object' + JSON.stringify(calibration),'');
          calibrations.push(calibration);
        }

        return calibrations;
      }
      else{
        return calibrations;
      }
      }
      catch(err){
        throw err;
      }
  }

  /**
  * Stores all the steps data required for a calibration @noOfSteps depending on how final charge is calculated.
  *
  */
  async saveCalibrationData(arrayOfMeasurements,calibId,stepId,stepStartTime): Promise<experimentDataObject>{
    let sqlArray = [];
    let length = arrayOfMeasurements.length;

    let date;
    let reading;
    let measurementRef;
    let timezoneOffset;
    let dataForProcessing: experimentDataObject = { length: length,
                          dataArray: [],
                          chartDateArray: [],
                          currentArray: [],
                          stepIdArray: [],
                          temperatureArray: [],
                          noOfMeasurementsPerStepArray: [],
                          stepStartTimeArray: [],
                          experimentId: calibId,
                          method: null
                        };
    try{
      for(var i=0;i<(length-1);i++){
        measurementRef = arrayOfMeasurements[i];
        date = measurementRef.date.toISOString();
        if(this.SharedService.deviceSetting.readData.RxAsString){
          reading = measurementRef.dataString;
        }
        else{
          reading = String(this.convertToInteger(measurementRef.dataBytesArray));
        }

        timezoneOffset = measurementRef.date.getTimezoneOffset();

        sqlArray.push(['INSERT into calibrationData(data,date,timezoneOffset,calibId,stepId,stepStartTime,noOfMeasurementsPerStep) VALUES (?,?,?,?,?,?,?)',
        [reading,date,timezoneOffset,calibId,stepId,stepStartTime,length]]);


        dataForProcessing.dataArray.push(reading);
        // dataForProcessing.chartDateArray.push(this.apply TimezoneOffset(timezoneOffset,date));
        dataForProcessing.chartDateArray.push(date);
        dataForProcessing.stepIdArray.push(stepId);
        //dataForProcessing.temperatureArray.push(stepRef.temperature);
        dataForProcessing.noOfMeasurementsPerStepArray.push(length);
        // dataForProcessing.stepStartTimeArray.push(this.apply TimezoneOffset(timezoneOffset,stepStartTime));
        dataForProcessing.stepStartTimeArray.push(stepStartTime);
      }
      dataForProcessing.length = length;
      await this.database.sqlBatch(sqlArray);
      return dataForProcessing;
    }
    catch(error){
      this.logError('Error inserting array of data ' + JSON.stringify(error,Object.getOwnPropertyNames(error)),error);
      throw error;
    }

  }

  /**
  * Delete calibration table row and all corresponding measured data.
  * @param unique calibration rowid
  */

  async deleteCalibration(calibId: number){
    try{
      let query = "Delete from calibrations where rowid=?";
      await this.database.executeSql(query,[calibId]);

      query = "DELETE from calibrationData where calibId=?";
      await this.database.executeSql(query,[calibId]);
      this.logError('All calibration data deleted','');
    }
    catch(e){
      throw e;
    }
  }

  /**
  * Create table to save post processing parameters set by user for experiments
  *
  *
  */
  async createPostProcessingParamsTable(){
    try{
      await this.database.executeSql('CREATE TABLE IF NOT EXISTS postProcessingParams(rowid INTEGER PRIMARY KEY, dateCreated TEXT, timezoneOffset TEXT NOT NULL DEFAULT (0), offset REAL,sensitivity REAL, unitOfCharge TEXT, unitDependentOnSensitivity TEXT, includeFirstMeasure BOOLEAN, algorithm TEXT, userId INTEGER,  deviceId INTEGER, FOREIGN KEY(userId) REFERENCES user(rowid),FOREIGN KEY(deviceId) REFERENCES sensorDevice(rowid))',{});
    }
    catch(err){
      throw err;
    }
  }
  /**
  * Save post processing parameters that are required to show results after processing raw data.
  * @param postProcessingParamObj: postProcessingParams (previously stepsObject )
  * @param userId: number unique user Id (rowid)
  * @param deviceId: number unique device Id (rowid )
  * @return postProcessingParamObj: postProcessingParams the same object passed as input param is updated with unique id and passed back by reference.
  */
  async addNewPostProcessingParamRecord(postProcessingParamObj,userId,deviceId): Promise<postProcessingParams>{
    try{
      let query = " INSERT INTO postProcessingParams (dateCreated,timezoneOffset,offset,sensitivity,unitOfCharge,unitDependentOnSensitivity,includeFirstMeasure, algorithm,userId,deviceId) VALUES (?,?,?,?,?,?,?,?,?,?)";
      let date = new Date();
      let dateCreated = date.toISOString();
      let timezoneOffset = date.getTimezoneOffset();

      let insertedData = await this.database.executeSql(query,[dateCreated,timezoneOffset,postProcessingParamObj.offset,postProcessingParamObj.sensitivity,postProcessingParamObj.unitOfCharge,postProcessingParamObj.unitDependentOnSensitivity,postProcessingParamObj.includeFirstMeasure,JSON.stringify(postProcessingParamObj.algorithm),userId,deviceId]);

      postProcessingParamObj.databaseRowid =  insertedData.insertId;
      return postProcessingParamObj;
    }
    catch(err){
      throw err;
    }
  }

  /**
  * Get postProcessingParams using its unique rowid.
  * @param rowid unique row id for postProcessingParams object.
  * @returns postProcessingParams object.
  */

  async getPostProcessingParam(rowid: number): Promise<postProcessingParams>{
    try{
      let length: number;
      let data = await this.database.executeSql("SELECT dateCreated,offset,sensitivity,unitOfCharge,unitDependentOnSensitivity,includeFirstMeasure,algorithm FROM postProcessingParams where rowid=" + rowid, []);
      this.logError(JSON.stringify(data.rows.item(0)),'');
      length = data.rows.length;
      if ( length > 0) {
        let row = data.rows.item(0);
        let includeFirstMeasure = (row.includeFirstMeasure == 'true');
        let postProcessingParamsObj: postProcessingParams = {
          databaseRowid: rowid,
          // dateCreated:(new Date(row.dateCreated)).toLocaleString(),
          offset: row.offset,
          sensitivity: row.sensitivity,
          unitOfCharge: row.unitOfCharge,
          unitDependentOnSensitivity: row.unitDependentOnSensitivity,
          includeFirstMeasure: includeFirstMeasure,
          algorithm: JSON.parse(row.algorithm)
        };
      //  this.logError('Database: postProcessingParams: ' + JSON.stringify(postProcessingParamsObj),'');
        return postProcessingParamsObj;
      }
      else{
        throw Error('Could not find a valid postProcessingParams record');
      }
    }
    catch(err){
      throw err;
    }
  }

  applyTimezoneOffset(timezoneOffset,chartDate){
    if(chartDate == null){
      return null;
    }
    let timestamp = new Date(chartDate).getTime();
    let newTime = timestamp + (-timezoneOffset * 60000);
    let dateWithOffset = new Date(newTime).toISOString();
    return dateWithOffset;
  }
  applyTimezoneOffsetToLocaleString(timezoneOffset,chartDate):string{

    let timestamp = new Date(chartDate).getTime();
    let newTime = timestamp + (-timezoneOffset * 60000);
    //let dateWithOffset = new Date(newTime).toLocaleString();
    this.logError('printing date with offset ' + new Date(newTime),'');
    return this.convertDateForSelectMenu(new Date(newTime));
  }


  /**
  ** @param date: Date cannot be null
  *  @return string in format - 'dd/mm/yyyy,HH:MM'
  **/

  convertDateForSelectMenu(date): string{

    if (date == null){
      throw Error('Date cannot be null');
    }


    let mm = date.getMinutes();
    let mmString: string;

    if(mm < 10){
      mmString = '0' + String(mm);
    }
    else{
        mmString = String(mm);
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

    return  utcDateString + '/' + utcMonthString + '/' + year + ',' + date.getHours() + ':' + mmString;
  }

  //***** TEST METHODS **********//

  testDateWithOffset(){
    let date = new Date();
    this.logError('Time isoString ', date.toISOString());
    this.logError('UTC hours ', date.getUTCHours());
    this.logError('timeoffset ' , date.getTimezoneOffset());
    this.logError('getTime ' , date.getTime());
    let newTime = date.getTime() + (-date.getTimezoneOffset() * 60000);
    this.logError('New time ', newTime);
    let newDate = new Date(newTime);
    this.logError('New date from offset is ' + newDate.toISOString() ,'');
  }

  //******* TEST STEPS ********* //
  //returns data of format data.rows.item()
  getStepsDataForDebugging(){
    return this.database.executeSql('Select * from step',[]);

  }
}
