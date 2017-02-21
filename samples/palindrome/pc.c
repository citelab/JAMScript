jasync isPalindromeC(char * text) {
   size_t length = strlen(text);
   size_t half = length / 2;
   size_t start = 0;
   size_t end = length - 1;
   char space = 32;
   char comma = 44;
   char startSpace, endSpace;

   while (half > 0) {
    startSpace = ( text[start] == space || text[start] == comma );
    endSpace = ( text[end] == space ||  text[end] == comma );

    if (text[start] == text[end]) {
      start++;
      end--;
    } else if (startSpace || endSpace) {
      start++;
      end--;
    } else {
      return;
    }

    half--;
   }

   return;
}

int main () {
  return 0;
}