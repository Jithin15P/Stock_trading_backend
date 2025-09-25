const {model}=require("mongoose")

const {userSchema}=require("../Schemas/UserSchema")
const UserModel= model("User",userSchema);

module.exports={UserModel};