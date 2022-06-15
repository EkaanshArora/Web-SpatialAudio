import { IAgoraRTCRemoteUser } from "agora-rtc-sdk-ng";

// utils
const addAudioToDom = (id: string) => {
  const audioTag = document.createElement('audio');
  audioTag.id = id;
  (document.getElementById('audio-container') as HTMLElement).appendChild(audioTag)
  return audioTag
}

const speed = 10

function moveUser(e: KeyboardEvent, localUserPosition: position, canvas: HTMLCanvasElement) {
  if(e.keyCode > 36 && e.keyCode < 41) {
    e.preventDefault()
  }
  switch (e.keyCode) {
    case 37:
      if(localUserPosition.x - speed > 0)
        localUserPosition.x = localUserPosition.x - speed;
      break;
    case 38:
      if(localUserPosition.y - speed > 0)
        localUserPosition.y = localUserPosition.y - speed;
      break;
    case 39:
      if(localUserPosition.x + 60 < canvas.width)
        localUserPosition.x = localUserPosition.x + speed;
      // right key pressed
      break;
    case 40:
      if(localUserPosition.y + 60 < canvas.height)
      localUserPosition.y = localUserPosition.y + speed;
      // down key pressed
      break;
  }
}  

const calcDistance = (user1: position, user2: position) => {
  return Math.sqrt(Math.pow(user1.x - user2.x, 2) + Math.pow(user1.y - user2.y, 2));
}

// typescript
export type position = {
  x: number,
  y: number
}
export type userState = {
  agoraUser: IAgoraRTCRemoteUser,
  position: position,
  distanceFromUser: number,
  panValue: number,
  panNode: StereoPannerNode,
  gainValue: number,
  gainNode: GainNode,
  isSubscribed: boolean,
  color: string,
}

export {addAudioToDom, moveUser, calcDistance}