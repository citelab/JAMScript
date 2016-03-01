/*
The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:
The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

#include "nanoutils.h"



int create_request_sock(char *hostname)
{
    int sock = nn_socket(AF_SP, NN_REQ);
    assert(sock >= 0);
    char *url = (char *)calloc(strlen(hostname) + 10, sizeof(char));
    sprintf(url, "tcp://%s:%d", hostname, REQUEST_PORT);
    assert(nn_connect (sock, url) >= 0);
    free(url);

    return sock;
}

char *pingmsg = "PING JCORE ";
int bytes = nn_send(sock, pingmsg, strlen(pingmsg), 0);
assert(bytes == strlen(pingmsg));



#endif
