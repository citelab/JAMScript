#include <unistd.h>
#include <time.h>
#include <stdlib.h>

int main(){
    srand(time(NULL));

    isFree = 1;

    while( 1 ){
        sleep(rand() % 20);
        isFree = (isFree + 1) % 2;
    }

    return 0;
}