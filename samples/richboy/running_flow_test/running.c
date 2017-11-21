#include <unistd.h>
#include <stdlib.h>

int main(){
    char* name;
    while( 1 ){
        temp = rand() % 15 + 15;

        int index = rand() % 3;
        if( index == 0 )
            name = "richboy";
        else if( index == 1 )
            name = "hilda";
        else if( index == 2 )
            name = "echomgbe";

        pack = {
            .name: name,
            .age: (rand() % 10) * (rand() % 5)
        };
        sleep(1);
    }
}