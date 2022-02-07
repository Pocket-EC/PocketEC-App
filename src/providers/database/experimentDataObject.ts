interface experimentDataObject {
  length: number; //No. of records in this object = length of dataArray.
  dataArray: Array<string>; //Response bits from bluetooth device.
  chartDateArray: Array<string>; //Timestamp when data stored.
  currentArray: Array<number>;
  temperatureArray: Array<string>;
  stepIdArray: Array<number>;
  noOfMeasurementsPerStepArray: Array<number>;
  stepStartTimeArray: Array<string>;
  method: methodParam;
  experimentId: number;
}
