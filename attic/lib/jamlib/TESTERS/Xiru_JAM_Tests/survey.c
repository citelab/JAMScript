
#include <nanomsg/nn.h>
#include <nanomsg/reqrep.h>
#include <nanomsg/survey.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <assert.h>

void main(){
    struct nn_pollfd pfd[1];
    pfd[0].fd = nn_socket(AF_SP, NN_RESPONDENT);
    pfd[0].events = NN_POLLIN;
    assert (nn_connect( pfd[0].fd, "tcp://127.0.0.1:7777") >= 0);

    while(1){
        int rc = nn_poll (pfd, 1, 1000);
        if (rc == -1) {
            printf ("Error!");
            exit (1);
        }
    if (pfd[0].revents & NN_POLLIN) {
        char buf[256];
        printf ("Message can be received from s1! %d\n", NN_POLLIN);
        int bytes = nn_recv (pfd[0].fd, &buf, NN_MSG, 0);
        printf("Bytes %d\n", bytes);
        //nn_send(pfd[0].fd, "hue", strlen("hue"), 0);
        }
    }
}

// #include <assert.h>
// #include <stdlib.h>
// #include <string.h>
// #include <time.h>
// #include <unistd.h>
// #include <stdio.h>
// #include <nanomsg/nn.h>
// #include <nanomsg/survey.h>

// #define SERVER "server"
// #define CLIENT "client"
// #define DATE   "DATE"

// char *date ()
// {
//   time_t raw = time (&raw);
//   struct tm *info = localtime (&raw);
//   char *text = asctime (info);
//   text[strlen(text)-1] = '\0'; // remove '\n'
//   return text;
// }

// int server (const char *url)
// {
//   int sock = nn_socket (AF_SP, NN_SURVEYOR);
//   assert (sock >= 0);
//   assert (nn_bind (sock, url) >= 0);
//   sleep(1); // wait for connections
//   int sz_d = strlen(DATE) + 1; // '\0' too
//   printf ("SERVER: SENDING DATE SURVEY REQUEST\n");
//   int bytes = nn_send (sock, DATE, sz_d, 0);
//   assert (bytes == sz_d);
//   while (1)
//     {
//       char *buf = NULL;
//       int bytes = nn_recv (sock, &buf, NN_MSG, 0);
//       if (bytes == ETIMEDOUT) break;
//       if (bytes >= 0)
//       {
//         printf ("SERVER: RECEIVED \"%s\" SURVEY RESPONSE\n", buf);
//         nn_freemsg (buf);
//       }
//     }
//   return nn_shutdown (sock, 0);
// }

// int client (const char *url, const char *name)
// {
//   int sock = nn_socket (AF_SP, NN_RESPONDENT);
//   assert (sock >= 0);
//   assert (nn_connect (sock, url) >= 0);
//   while (1)
//     {
//       char *buf = NULL;
//       int bytes = nn_recv (sock, &buf, NN_MSG, 0);
//       if (bytes >= 0)
//         {
//           printf ("CLIENT (%s): RECEIVED \"%s\" SURVEY REQUEST\n", name, buf);
//           nn_freemsg (buf);
//           char *d = date();
//           int sz_d = strlen(d) + 1; // '\0' too
//           printf ("CLIENT (%s): SENDING DATE SURVEY RESPONSE\n", name);
//           int bytes = nn_send (sock, d, sz_d, 0);
//           assert (bytes == sz_d);
//         }
//     }
//   return nn_shutdown (sock, 0);
// }

// int main (const int argc, const char **argv)
// {
//   if (strncmp (SERVER, argv[1], strlen (SERVER)) == 0 && argc >= 2)
//     return server (argv[2]);
//   else if (strncmp (CLIENT, argv[1], strlen (CLIENT)) == 0 && argc >= 3)
//     return client (argv[2], argv[3]);
//   else
//     {
//       fprintf (stderr, "Usage: survey %s|%s <URL> <ARG> ...\n",
//                SERVER, CLIENT);
//       return 1;
//     }
// }
