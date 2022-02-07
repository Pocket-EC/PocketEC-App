interface techniqueParam{
  databaseRowid: number; //localdatabase unique rowid from step table.
  stepNumber: number; //denotes order of steps in a method. 
  methodId: number; //method rowid from localdatabase.
  potential: {description: string, command: number,index:number,intZ: {description: string,index: number}};
  gain: {description: string, command: number,index: number, rLoad: {description: string,index: number}};
  duration: number;
  color: string; //needed only for Settings view
  rLoadWheelSelectorTitle: string;
  save: boolean;
  dataFrequency: number;
  zeroOffset: number;
  scalingFactor: number;
  unitOfCurrent: string;


}
