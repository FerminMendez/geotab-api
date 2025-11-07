"""
Geotab Data Extractor

A tool to extract data from Geotab API and export to CSV files.
"""

import csv
import logging
import os
from datetime import datetime
from typing import Dict, List, Optional

import mygeotab
from dotenv import load_dotenv

load_dotenv()


class GeotabConfig:
    """Manages Geotab API configuration and environment variables."""

    def __init__(self):
        """Initialize configuration from environment variables."""
        self.username = os.getenv("GEOTAB_USERNAME")
        self.database = os.getenv("GEOTAB_DATABASE")
        self.password = os.getenv("GEOTAB_PASSWORD")
        self.export_directory = os.getenv("EXPORT_DIRECTORY", "./exports")
        self.batch_size = int(os.getenv("MAX_RECORDS_PER_BATCH", "500"))

        self._validate_required_variables()

    def _validate_required_variables(self) -> None:
        """Validate that required environment variables are set."""
        required_vars = [self.username, self.database, self.password]
        if not all(required_vars):
            raise ValueError(
                "Missing required environment variables: "
                "GEOTAB_USERNAME, GEOTAB_DATABASE, GEOTAB_PASSWORD"
            )

    def ensure_export_directory_exists(self) -> None:
        """Create export directory if it doesn't exist."""
        os.makedirs(self.export_directory, exist_ok=True)


config = GeotabConfig()


def create_logger() -> logging.Logger:
    """Create and configure logger for the application."""
    config.ensure_export_directory_exists()

    log_file_path = os.path.join(config.export_directory, "geotab_export.log")

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
        handlers=[
            logging.FileHandler(log_file_path, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )
    return logging.getLogger(__name__)


# Entity types available for extraction from Geotab API
SUPPORTED_ENTITY_TYPES = [
    "Device",
    "Trip",
    "User",
    "Zone",
    "Rule",
    "FaultData",
    # Note: LogRecord and StatusData are commented out due to their extremely large size
    # Uncomment with caution as they may contain millions of records
    # "LogRecord",
    # "StatusData",
]


def fetch_entity_data(
    api: mygeotab.API, entity_type: str, logger: logging.Logger
) -> Optional[List[Dict[str, str]]]:
    """
    Fetch all entities of a specific type from Geotab API.

    Args:
        api: Authenticated Geotab API instance
        entity_type: Type of entity to fetch (e.g., 'Device', 'Trip')
        logger: Logger instance for progress tracking

    Returns:
        List of entity dictionaries, or None if an error occurred

    Raises:
        Exception: If API call fails or data retrieval encounters an error
    """
    logger.info(f"Starting fetch of '{entity_type}' data...")

    fetched_entities = []

    try:
        entity_generator = api.get(entity_type)

        for entity in entity_generator:
            fetched_entities.append(entity)

            if len(fetched_entities) % config.batch_size == 0:
                logger.info(f"Progress: {len(fetched_entities)} {entity_type}s fetched")

    except Exception as error:
        logger.error(f"Failed to fetch {entity_type} data: {error}")
        return None

    logger.info(
        f"Completed: {len(fetched_entities)} {entity_type}s fetched successfully"
    )
    return fetched_entities


def export_data_to_csv(
    entity_data: List[Dict[str, str]], entity_type: str, logger: logging.Logger
) -> bool:
    """
    Export entity data to a timestamped CSV file.

    Args:
        entity_data: List of entity dictionaries to export
        entity_type: Name of the entity type for filename generation
        logger: Logger instance for progress tracking

    Returns:
        True if export succeeded, False otherwise
    """
    if not entity_data:
        logger.warning(f"No {entity_type} data to export, skipping...")
        return False

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_filename = f"{entity_type}_{timestamp}.csv"
    csv_file_path = os.path.join(config.export_directory, csv_filename)

    try:
        logger.info(f"Exporting {len(entity_data)} {entity_type} records...")

        # Extract all unique field names from all records
        all_field_names = set()
        for record in entity_data:
            all_field_names.update(record.keys())

        # Sort field names for consistent column ordering
        sorted_field_names = sorted(all_field_names)

        with open(csv_file_path, "w", newline="", encoding="utf-8") as csv_file:
            csv_writer = csv.DictWriter(csv_file, fieldnames=sorted_field_names)
            csv_writer.writeheader()
            csv_writer.writerows(entity_data)

        logger.info(
            f"Successfully exported {csv_filename} with {len(entity_data)} records"
        )
        return True

    except Exception as error:
        logger.error(f"Export failed for {entity_type}: {error}")
        return False


def main() -> None:
    """Execute the complete Geotab data extraction and export process."""
    logger = create_logger()
    logger.info("Starting Geotab data export process...")

    try:
        logger.info("Authenticating with Geotab API...")

        api = mygeotab.API(
            username=config.username, password=config.password, database=config.database
        )
        api.authenticate()

        logger.info("Authentication successful!")

        export_statistics = {"successful": 0, "failed": 0}

        for entity_type in SUPPORTED_ENTITY_TYPES:
            logger.info(f"\n--- Processing {entity_type} entities ---")

            entity_data = fetch_entity_data(api, entity_type, logger)

            if entity_data:
                export_success = export_data_to_csv(entity_data, entity_type, logger)
                if export_success:
                    export_statistics["successful"] += 1
                else:
                    export_statistics["failed"] += 1
            else:
                export_statistics["failed"] += 1
                logger.error(f"Data fetch failed for {entity_type}")

        _log_final_summary(logger, export_statistics)

    except mygeotab.exceptions.AuthenticationException as auth_error:
        logger.error(f"Authentication failed: {auth_error}")
        logger.error("Please verify your credentials in the .env file")
    except ValueError as config_error:
        logger.error(f"Configuration error: {config_error}")
    except Exception as unexpected_error:
        logger.error(f"Unexpected error occurred: {unexpected_error}")
        raise


def _log_final_summary(logger: logging.Logger, stats: Dict[str, int]) -> None:
    """Log the final summary of export operations."""
    logger.info("\n🎉 Export process completed!")
    logger.info(f"✅ Successful exports: {stats['successful']}")

    if stats["failed"] > 0:
        logger.warning(f"❌ Failed exports: {stats['failed']}")

    logger.info(f"📁 Files exported to: {config.export_directory}")


if __name__ == "__main__":
    main()
