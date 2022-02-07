interface methodParam{
  name: string;
  dateCreated: string;
  dateModified: string;
  dateModified_localString: null|string;
  listOfPreconditions: Array<techniqueParam>;
  preconditionRepetition: number;
  listOfMeasures: Array<techniqueParam>;
  measuresRepetition: number;
  continuousMeasure: boolean;
  postMeasureSetContinuousVoltage:boolean;
  unitOfCurrent: string;
  databaseRowid: number;
  deviceId:number;
  userId: number;
}
