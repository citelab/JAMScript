#include <stdio.h>
#include <stdlib.h>

void f() {
    // no-op
}

char* pullTargets();

jsync_ctx int collect_targets(char* id) {
    printf("Received request for targets from fog %s\n", id);
    char* targets = pullTargets();
    targs = targets;
    free(targets);
    return 0;
}

int main(int argc, char* argv[]) {
    return 0;
}
