struct announce_msg_t am;

jasync loop() {
    
    while(1) {
	am = announce_msg;
	printf("Field %s, Index %d\n", am.field, am.index);
    }    
}


jasync messager() {

    while(1) {
	jsleep(500);
	printf("Printing a message..\n");
    }
}



int main() {

    messager();
    loop();

}
