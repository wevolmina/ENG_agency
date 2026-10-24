import kitchenImage from "./assets/kitchen-flat.svg";
export const spacePackages={
 "bedroom-lighting":{space:"침실",name:"편안한 밤 조명 패키지",description:"협탁 조명 + 헤드보드 간접 조명",caption:"따뜻한 빛으로 완성하는 나만의 휴식",experience:"/bedroom/",image:"/bedroom/scene.svg",category:"BEDROOM / LIGHTING"},
 "kitchen-sensing":{space:"주방",name:"주방 센서 조명 패키지",description:"가상 재실 센서 + 문 열림 센서 + 작업대 조명",caption:"필요한 순간에 켜지는 작업대의 빛",experience:"/kitchen/",image:kitchenImage,category:"KITCHEN / SENSOR LIGHTING"}
} as const;
export type SpaceProductId=keyof typeof spacePackages;
export function isSpaceProductId(value:unknown):value is SpaceProductId{return typeof value==="string"&&Object.hasOwn(spacePackages,value)}
