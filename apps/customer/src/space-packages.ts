import kitchenImage from "./assets/kitchen-flat.svg";
import deskImage from "./assets/desk-flat.svg";
export const spacePackages={
 "bedroom-lighting":{space:"침실",name:"편안한 밤 조명 패키지",description:"협탁 조명 + 헤드보드 간접 조명",caption:"따뜻한 빛으로 완성하는 나만의 휴식",experience:"/bedroom/",image:"/bedroom/scene.svg",category:"BEDROOM / LIGHTING"},
 "kitchen-sensing":{space:"주방",name:"주방 센서 조명 패키지",description:"가상 재실 센서 + 문 열림 센서 + 작업대 조명",caption:"필요한 순간에 켜지는 작업대의 빛",experience:"/kitchen/",image:kitchenImage,category:"KITCHEN / SENSOR LIGHTING"},
 "desk-focus":{space:"데스크테리어",name:"데스크테리어 집중 패키지",description:"책상 조명 + 가상 집중 모드",caption:"나의 책상에서 시작하는 차분한 집중",experience:"/#desk-focus",image:deskImage,category:"DESK / FOCUS"}
} as const;
export type SpaceProductId=keyof typeof spacePackages;
export function isSpaceProductId(value:unknown):value is SpaceProductId{return typeof value==="string"&&Object.hasOwn(spacePackages,value)}
