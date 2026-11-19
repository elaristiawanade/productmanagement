package com.producttracker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling   // WeeklySnapshotService freezes the Management Dashboard's weekly Open Item list
public class ProductTrackerApplication {
    public static void main(String[] args) {
        SpringApplication.run(ProductTrackerApplication.class, args);
    }
}
