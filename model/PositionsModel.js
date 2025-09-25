const {model}=require("mongoose")

const {PositionsSchema}=require("../Schemas/PositionsSchema")
const PositionsModel= new model("Positions",PositionsSchema);

module.exports={PositionsModel};