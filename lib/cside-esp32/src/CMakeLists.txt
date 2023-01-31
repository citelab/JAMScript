idf_component_register(SRCS "entry.c" "calls.c" "cnode.c" "tboard.c" "command.c" "task.c" "nvoid.c" "util.c"
                    INCLUDE_DIRS "." "../include"
                    REQUIRES jam_component_wrap lwip esp_netif esp_wifi)
