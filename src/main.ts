export let appId = '<Agora App ID>';

import "./style.css";
import AgoraRTC, { IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import { addAudioToDom, initStop, moveUser, userState, calcDistance } from './utils'
import AgoraRTM, { RtmTextMessage } from 'agora-rtm-sdk';
import { position } from './utils';

let channelId = 'test';
let token: string | null = null;
let loggedIn = false

// Setup
AgoraRTC.setLogLevel(2);
const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
const rtmClient = AgoraRTM.createInstance(appId, {logFilter: AgoraRTM.LOG_FILTER_WARNING});
const rtmChannel = rtmClient.createChannel("location");
const canvas = document.querySelector('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

// position setup
const squareSize = 50
const distanceToUnsubscribe = 150
const getRandomValue = () => Math.random() * (canvas.width - squareSize)
const localUserPosition = { x: getRandomValue(), y: getRandomValue() }
const remoteUsers: { [uid: number]: userState } = {}
const sendPositionRTM = (position: position) => {
  rtmChannel.sendMessage({ text: JSON.stringify(position) })
}

// audio context setup
const audioContext = new AudioContext();
const audioElement = addAudioToDom('audio');
const final = audioContext.createMediaStreamDestination();
audioElement.srcObject = final.stream

const handleAudioPublish = async (agoraUser: IAgoraRTCRemoteUser) => {
  let positionData = { x: -500, y: -500 }
  
  await client.subscribe(agoraUser, "audio" ).catch(e => { console.log(e) });;
  // medistream from rtc track
  const track = agoraUser.audioTrack?.getMediaStreamTrack()
  const stream = new MediaStream()
  track ? stream.addTrack(track) : {};

  // audio context setup
  const pan = audioContext.createStereoPanner();
  const gain = audioContext.createGain();
  gain.gain.value = 1;
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(gain);
  gain.connect(pan);
  pan.connect(final);
  audioContext.resume();
  audioElement.play();

  // update state
  remoteUsers[agoraUser.uid as number] = {
    distanceFromUser: (calcDistance(localUserPosition, positionData)),
    gainNode: gain,
    gainValue: 1,
    panNode: pan,
    panValue: 0,
    position: positionData,
    agoraUser: agoraUser,
    isSubscribed: true,
    color: '#' + Math.floor(Math.random() * 16777215).toString(16)
  }
}

const refreshAudio = async (remoteUser: userState) => {
  // update state first to avoid multiple calls
  remoteUser.isSubscribed = true

  await client.subscribe(remoteUser.agoraUser, "audio" ).catch(e => { console.log(e) });;
  console.log('subscribe', remoteUser.agoraUser.uid)
  // medistream from rtc track
  const track = remoteUser.agoraUser.audioTrack?.getMediaStreamTrack()
  const stream = new MediaStream()
  track ? stream.addTrack(track) : {};

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(remoteUser.gainNode);
  audioContext.resume();
  audioElement.play();
}

const startBtn = (<HTMLInputElement>document.getElementById('start'));

let locationIntervalId = setInterval(() => {
  if (loggedIn) sendPositionRTM(localUserPosition)
}, 200);

let startCall = async () => {
  const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
  startBtn.disabled = true;
  initStop(client, rtmClient, rtmChannel, localAudioTrack, locationIntervalId, remoteUsers);

  /* RTC */
  client.on("user-published", async (user, mediaType) => {
    console.log(`!User ${user.uid} published ${mediaType}`);
    if (mediaType === "audio") {
      handleAudioPublish(user)
    }
  });

  client.on("user-unpublished", async (user, mediaType) => {
    if (mediaType === "audio") {
      user.audioTrack?.stop()
      delete remoteUsers[user.uid as number]
    }
  });

  const uid = await client.join(appId, channelId, token, null);
  await client.publish([localAudioTrack]).catch(e => { console.log(e) });
  console.log('joined RTC: ' + uid);

  /* RTM */
  rtmChannel.on('MemberJoined', function (memberId) {
    console.log('!join', memberId);
  })

  rtmChannel.on('ChannelMessage', (message, uid) => {
    let position: position = JSON.parse((message as RtmTextMessage).text);
    remoteUsers[parseInt(uid)].position = position;
  });

  await rtmClient.login({ uid: String(uid) })
  await rtmChannel.join()
  console.log('joined RTM: ' + uid + ' ' + rtmChannel.channelId);
  
  loggedIn = true
};

startBtn.onclick = startCall;

const draw = () => {
  ctx.fillStyle = '#eee';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#333';
  ctx.fillRect(localUserPosition.x, localUserPosition.y, squareSize, squareSize);
  ctx.font = '16px Arial';
  ctx.fillText("you", localUserPosition.x + 12, localUserPosition.y + squareSize + 12);
  Object.values(remoteUsers).map((remoteUser) => {
    ctx.fillStyle = remoteUser.color;
    ctx.strokeStyle = remoteUser.color;
    ctx.fillRect(remoteUser.position.x, remoteUser.position.y, squareSize, squareSize);
    ctx.fillText(String(remoteUser.agoraUser.uid), remoteUser.position.x - 18, remoteUser.position.y + squareSize + 15);
    ctx.beginPath();
    ctx.arc(remoteUser.position.x + (0.5 * squareSize), remoteUser.position.y + (0.5 * squareSize), distanceToUnsubscribe - 25, 0, 2 * Math.PI);
    ctx.stroke();
    remoteUser.distanceFromUser = calcDistance(localUserPosition, remoteUser.position);
    if(remoteUser.distanceFromUser > distanceToUnsubscribe && remoteUser.isSubscribed) {
      console.log('unsubscribe', remoteUser.agoraUser.uid)
      client.unsubscribe(remoteUser.agoraUser, "audio" ).catch(e => { console.log(e) });;
      remoteUser.isSubscribed = false
    } else if(remoteUser.distanceFromUser < distanceToUnsubscribe && !remoteUser.isSubscribed) {
      refreshAudio(remoteUser)
    }
    let originPoint = { x: remoteUser.position.x, y: localUserPosition.y };
    let distanceToOrigin = calcDistance(originPoint, remoteUser.position);
    remoteUser.panValue = (localUserPosition.x < remoteUser.position.x ? 1 : -1) * (1 - (Math.asin(distanceToOrigin / remoteUser.distanceFromUser) / (Math.PI / 2)));
    remoteUser.gainValue = Math.sqrt(canvas.width * 2 + canvas.height * 2) / 2 / (remoteUser.distanceFromUser);
    remoteUser.panNode.pan.value = remoteUser.panValue;
    remoteUser.gainNode.gain.value = remoteUser.gainValue;
  })
  requestAnimationFrame(draw);
}

draw();

window.addEventListener("keydown", (e) => moveUser(e, localUserPosition, canvas), false);
