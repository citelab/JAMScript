jsync function setup() {
  if(typeof ID == "undefined") {
    ID = 1;
    msg_list = ["Chat Service Initiated... "];
    msg_id = 1;
  }
  return 0;
}

jsync function get_past_msg(num_msg){
  var begin = 0;
  var end = num_msg;
  var ret = "";
  if(num_msg < msg_list.length) {
    begin = msg_list.length - num_msg;
  } else {
    end = msg_list.length;
  }
  ret += msg_list.slice(begin, end).join("");
  ret.replace(",","");
  console.log("We are sending.... \n-------------------------------------------------\n" + ret)
  return ret;
}

jsync function get_new_id(status_msg) {
  console.log(status_msg + " and " + ID);
  ID += 1;
  return ID;
}

jasync function j_node_get_msg(usr_name, msg, user_id) {
  msg_list.push(usr_name + ":" + msg);
  c_node_get_msg(usr_name, msg, user_id, msg_id++);
}

