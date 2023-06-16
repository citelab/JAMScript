
jasync loop() {
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


    loop();
    

}
