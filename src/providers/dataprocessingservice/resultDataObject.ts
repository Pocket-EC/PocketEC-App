interface resultObject {
  noOfMeasurementsPerStepArray: Array<number>;
  currentIntegratedArray: Array<number>;
  sumOfCurrentArray: Array<number>;
  sumOfCurrentIntegratedArray: Array<{stepId:number;value: number}>; //sum of integrated current in each step.
  datetimeForCurrentArray: Array<string>;//the last data's datetime is stored for plotting result.
  timeDiffArray: Array<number>; // time between data collection
  experimentalStepDurationArray: Array<number>; //stores experimental step duration - Ttot
  diffBetwTheoreticalAndExperimentalStepDurationArray: Array<number>; //Txs=Ttot-Tstep
  lastPointCorrectionFactorArray: Array<number>; //Txs/Tn where Tn is last point of step.
  correctedSumOfCurrentIntegratedArray: Array<{stepId:number;value: number}>; // Astep or value = Atot – (An. Txs/Tn)
}
