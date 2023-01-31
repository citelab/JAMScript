#include "system_manager.h"
#include <esp_netif_sntp.h>
#include <esp_sntp.h>
#include <lwip/ip_addr.h>
#include <esp_wifi.h>

#include <stdlib.h>

system_manager_t _global_system_manager;

system_manager_t* system_manager_init()
{
    system_manager_t* system_manager = &_global_system_manager;
    memset(system_manager, 0, sizeof(system_manager_t));

    _system_manager_board_init(system_manager);
    _system_manager_rtc_sync_ntp(system_manager);

    system_manager->initialized = true;
    return system_manager;
}

void _system_manager_board_init(system_manager_t* system_manager)
{
    ESP_ERROR_CHECK(nvs_flash_init());
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    wifi_init_config_t wifi_config = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&wifi_config));

    //TODO: might have to initialize in station mode

}

void _system_manager_rtc_sync_ntp(system_manager_t* system_manager)
{
    ESP_LOGI(TAG, "Initializing and starting SNTP");

    // This is rtc sync code from esp32 examples
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG(CONFIG_SNTP_TIME_SERVER);

    config.sync_cb = time_sync_notification_cb;
    esp_netif_sntp_init(&config);

    time_t now = 0;
    struct tm timeinfo = { 0 };
    int retry = 0;
    const int retry_count = 15;

    while (esp_netif_sntp_sync_wait(2000 / portTICK_PERIOD_MS) == ESP_ERR_TIMEOUT && ++retry < retry_count) 
    {
        ESP_LOGI(TAG, "Waiting for system time to be set... (%d/%d)", retry, retry_count);
    }

    assert(retry != retry_count && "Failed to connect to sntp");

    time(&now);
    localtime_r(&now, &timeinfo);

    esp_netif_sntp_deinit();
}