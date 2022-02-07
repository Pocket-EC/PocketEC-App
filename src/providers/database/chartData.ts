interface chartData {
  length: number; //No. of records in this object = length of dataArray.
  dataArray: Array<string>; //Response bits from bluetooth device.
  chartDateArray: Array<string>; //Timestamp when data stored.
  commandArray: Array<string>; //Gain and potential parameters.
  rLoadAndIntZArray: Array<string>; //rLoad and internal zero parameters.
  samplingSetupArray: Array<string>; //Duration of step and Data sampling frequency.
  zeroOffsetArray: Array<string>;
  scalingFactorArray: Array<string>;
  unitOfCurrentArray: Array<string>;
  stepsArray: Array<number>; //abstract number identifying a step with unique combination of command,rLoadAndIntZ & sampling.
  stepsObjectForAnalysis: { //Used for Analysis.
                            commandArray: Array<string>;
                          };
}
