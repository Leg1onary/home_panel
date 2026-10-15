// World-space elevations. Never place a room face on the foundation's top face:
// even identical decimal coordinates differ after GPU transforms and cause z-fighting.
export const modelLevels=Object.freeze({
 foundationTop:0,
 houseThickness:.18,
 terraceThickness:.14,
 floor:.08,
 outline:.095,
 ground:-.20
});
