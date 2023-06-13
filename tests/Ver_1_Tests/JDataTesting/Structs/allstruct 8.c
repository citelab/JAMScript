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


jasync logger() {
    char *names[10] = {"david", "mayer", "justin", "richard", "lekan", "ben", "owen", "nicholas", "karu", "clark"};
    int i;
    char buf[32];


    while(1) {
        sensor_data = {.sd_val:i*10.5 + 2.4 * strlen(names[i%10]) , .name: names[i%10] , .index: i};
        printf("Pushed.. sensed data \n");
        i++;
        jsleep(500);
    }
}


int main() {

    messager();
    loop();
    logger();
    
}
