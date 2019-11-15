var textPR = document.getElementById('textPR');
var sendCal = document.getElementById('js-send-calTrigger');

var heartRateData;                // 0. Heart rate data
var respRateData;                 // 1. Resp. rate data
var spo2 = 99;                    // 2. SpO" data
var batteryLevel;                 // 3. Battery Level
var dataSendParameters = [];      // Parameter Data to send
var dataSendWaveforms = [[]];     // Waveform Data to send (8ch x DataCount[ms])
var timer1 =0;                    // Interval timer
var connectedBLE = 0;             // 0: BLE not connected,       1: BLE connected
var sendWaveforms = 0;            // 0: Send waveforms Off,      1: On
var applicationMode;              // 0: Patient mode,            1: Doctor mode
var calCommand = 0;               // 0: Cal Off,                 1: On

textPR.addEventListener('click', function() {
  textPR.textContent = '..';
  heartRates = [];
  heartRateSensor.connect()
  .then(() => heartRateSensor.startNotificationsHeartRateMeasurement().then(handleHeartRateMeasurement))
  .catch(error => {
    const messages = document.getElementById('js-messages');
    messages.textContent = error;
  });
});



// ********************************************************************
//  Send parameters when data acquired via Web Bluetooth
// ********************************************************************
function handleHeartRateMeasurement(heartRateMeasurement) {
  heartRateMeasurement.addEventListener('characteristicvaluechanged', event => {
    var heartRateMeasurement = heartRateSensor.parseHeartRate(event.target.value);
    
    // Set parameters (Heart rate and Battery Level) to the local side
    heartRateData = heartRateMeasurement.heartRate;
    textPR.innerHTML = heartRateData;

    heartRateSensor.getBatteryLevel();
    statusBatteryLavel.textContent = batteryLevel;
    
    statusSpo2.textContent = spo2;

    // Send array data to the remote side
    dataSendParameters[0] = heartRateData;
    dataSendParameters[1] = 0; // Reserved
    dataSendParameters[2] = spo2;
    dataSendParameters[3] = batteryLevel;
    dataSendParameters[4] = 0; // Reserved

    if(peer.open){
      room.send(dataSendParameters);
    }
    
    // BLE Connected
    connectedBLE = 1;
  });
}

// ********************************************************************
//  Send ECG Data by each interval time
// ********************************************************************
function transmitData() {
  if(connectedBLE == 1 && youJoyned == 1 && peer.open){

    console.log("transmitData event!!");

    // ECG or Cal data to be sent
    if(calCommand == 0){
      dataSendWaveforms = ecgData.slice(NowPoint, NowPoint + DataCount);
    }else{
      dataSendWaveforms = calData.slice(0, 199);
      calCommand = 0;
    }
    NowPoint+=DataCount;
    if (NowPoint >= BufSize) {
      NowPoint = 0;
    }
    room.send(dataSendWaveforms);
    
    //SpO2 data increment for test purpose
    spo2 = spo2 >= 99 ? 80 : spo2 + 1;
  }
}

// ********************************************************************
//  Send Cal
// ********************************************************************
function onCalSend() {
  calCommand = 1;
  console.log("onCalSend event!");
}


// ********************************************************************
//  Initial setup
// ********************************************************************
window.onload = function () {
  // Make position offset for each waveform
  for (var k = 0; k < 12; ++k) {
    Voffset[k] = (k + 1) * (oy / (6 + 0.5));
  }

  // Make canvas and get its size
  cvs = document.getElementById("waveformCanvas");
  m_workDC = cvs.getContext('2d');
  cvs.setAttribute("width", ox * displayResolution);
  cvs.setAttribute("height", oy * displayResolution);
  m_workDC.scale(displayResolution, displayResolution);

  m_workDC.fillStyle = "#00FF00";
  m_workDC.font = "20px Verdana";
  m_workDC.textAlign = "left";
  m_workDC.textBaseline = "top";

  WaveStepsPerDot = (ox - stdW) / Sweep;	            // Number of count up step per sample


  // Hide Send ECG Waveform Button in patient mode
  if(applicationMode == 0){
    const localText = document.getElementById('js-local-text');
    const sendTrigger = document.getElementById('js-send-trigger');
    localText.style.display = "none";     // Patient mode (Hide button and text)
    sendTrigger.style.display = "none";
  }

  // Hide CAL button for all mode
  sendCal.style.display = "none";

}
