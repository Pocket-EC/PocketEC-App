// rowid INTEGER PRIMARY KEY, date TEXT, time TEXT, data TEXT, serverUpdated Boolean,dateUpdated TEXT
export class SensorData {
  rowid: number;
  date: string;
  time: string;
  data: string;
  serverUpdated: boolean;
  dateUpdated: string;
}
