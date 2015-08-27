#include <stdio.h>

int main()
{
   int x = 'a';
   char y = x;
   int c;
   char *b;
   char *a = "hello";
   char destarray[10];
   char *dest = &destarray[0];
   char *src = a;

   printf("%s\n", a);

   c = *a;

   for (b = a; *b != 0; b++)
      printf("%c: %d\n", *b, *b);

   while (*src != 0)
      *dest++ = *src++;

   *dest = 0;

   printf("copied string is %s\n", destarray);

   return 0;
}
