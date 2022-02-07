interface postProcessingParams{
  databaseRowid: number; //uniqe rowid from database
  unitOfCharge: string;
  offset: number;
  sensitivity: number;
  unitDependentOnSensitivity:string;
  includeFirstMeasure: boolean;
  algorithm: algorithm;
}
