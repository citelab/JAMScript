#include <stdio.h>

typedef int MyInt;

struct FunStruct
{
   int i;
   int j;
};

typedef struct FunStruct MyFunStruct;

typedef MyFunStruct *MoreFunThanEver;

int main()
{
   MyInt a = 1;
   MyFunStruct b;
   MoreFunThanEver c = &b;

   printf("%d\n", a);

   b.i = 12;
   b.j = 34;
   printf("%d,%d\n", b.i, b.j);

   printf("%d,%d\n", c->i, c->j);

   return 0;
}

/* vim: set expandtab ts=4 sw=3 sts=3 tw=80 :*/
