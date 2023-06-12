
jasync dotask() {
    printf("Doing tasks.. \n");
	int num = 1;
    while(1) {
        y = num++;
        jsleep(100);
    }
}

void main() {
    dotask();
}


// jasync dologging() {
//     int num = 1;
//     while(1) {
//         y = num++;
//         jsleep(900);
//     }
// }

// void main() {
//     dologging();
// }