#include "carapi/car_api.h"

int ping_iterations = 10;

jtask* carping(int x) {
    printf("recieved %d from fog\n", x);
    ping_iterations = x;
}

jtask* localme(int dec) {
    struct Car car = setup_new_car()
    int motor_away = 0;
    while(1) {
        jsleep(10000000);
        if(ping_iterations > 0) {
            printf("decrementing...\n");
            ping_iterations -= dec;
            if(!motor_away) {
                motor_away = 1;
                move_car_fwd(car);
            }
        } else if(motor_away) {
            motor_away = 0;
            move_car_bwd(car);
        }

    }
}

int main(int argc, char*argv[]) {
    localme(1);
    return 0;
}
