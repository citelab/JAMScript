#include <stdio.h>

int getID();
int wReady(int x);

int cnt = 0;
int id = -1;

int xxxx() {
    return 1;
}


jsync int runatsametime(int x) {

    printf("Run the barrier function at step %d from worker #%d\n", x, id);
    //localworker(x);
    int temp = 0;
    while(!temp) {
//        temp = wReady(id);
	temp = wReady(1);
	
    } 
    cnt++;
    return cnt;
}


// jasync localworker(int x) {
//     //cnt++;
//     printf("Prints from the local worker from the %d-th barrier.\n", x);
//     jsleep(100);
// }

jasync get_myid() {
  while(1) {
    id = getID();
    if (id >= 0) {
        printf("Got my id --> %d", id);
        return;
    }
    jsleep(300);
  }
}

jasync stupidtask() {
    while(1) {
         printf("Doing pointless stuff...\n");
         jsleep(1000);
    }
}

int main(int argc, char *argv[]) {
    get_myid();
    stupidtask();
    return 0;
}
