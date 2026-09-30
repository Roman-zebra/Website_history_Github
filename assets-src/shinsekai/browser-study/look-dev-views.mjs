// Fixed review views, not photographic camera estimates. Browser Y is up.
export const LOOK_DEV_VIEWS=Object.freeze({
 'north-overview':{position:[85,55,115],target:[0,30,0],fov:48},
 'south-oblique':{position:[-38,5,-65],target:[0,32,0],fov:58},
 'roof-transfer':{position:[-32,26,40],target:[0,17,0],fov:55},
 'shaft-detail':{position:[30,46,45],target:[0,42,0],fov:48},
 'upper-gallery':{position:[24,67,34],target:[0,63,0],fov:48}
});
export const LOOK_DEV_SIZE=[1280,720];
export const SCENE_LOOK_VIEWS=Object.freeze({
 'north-overview':{...LOOK_DEV_VIEWS['north-overview'],mode:'dusk'},
 'south-oblique':{...LOOK_DEV_VIEWS['south-oblique'],mode:'dusk'},
 'street-hero':{position:[-55,1.5,80],target:[0,31,0],fov:41.1,mode:'dusk'},
 'roof-garden':{position:[-32,26,40],target:[0,17,0],fov:55,mode:'dusk'},
 'aerial-dusk':{position:[80,110,120],target:[0,25,0],fov:48,mode:'dusk'},
 'night-street':{position:[20,1.5,55],target:[0,6,0],fov:41.1,mode:'night',weather:'rain'}
});
