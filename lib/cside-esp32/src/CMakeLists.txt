idf_component_register(SRCS "entry.c" "calls.c" "cnode.c" "task.c" "command.c" "nvoid.c" "util.c" "system_manager.c"
                    INCLUDE_DIRS "." "../include"
                    REQUIRES freertos jam_component_wrap nvs_flash esp_event lwip esp_netif esp_wifi)
