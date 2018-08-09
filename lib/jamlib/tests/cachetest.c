#include "../simplelist.h"
#include <stdlib.h>
#include <stdio.h>

list_elem_t *cache;


void putcache()
{
    char str[64];

    while(1)
    {
        printf("Enter string > ");
        scanf("%s", str);
        if (strlen(str) <= 1)
            break;

        if (find_list_item(cache, str))
            printf("FOUND in cache\n");
        else
            put_list_tail(cache, strdup(str), strlen(str));
    }
}

void listcache()
{
    int len;
    len = list_length(cache);
    printf("Number of elements in cache: %d\n", len);
    print_list(cache);
}


int main(int argc, char *argv[])
{
    int sel;
    cache = create_list();

    while(1)
    {
        printf("\n1. Put cache\n2. List cache\n3. Evict last 4. End");
        scanf("%d", &sel);
        switch(sel) {
            case 1:
                putcache();
                printf("After putcache\n");
            break;
            case 2:
                listcache();
            break;
            case 3:
                del_list_tail(cache);
            break;
            default:
                exit(0);
            break;
        }
    }
}
