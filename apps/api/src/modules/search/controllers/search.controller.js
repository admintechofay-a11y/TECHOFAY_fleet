/**
 * Search Controller
 * Handles global search queries across the system.
 */

const SearchService = require('../services/search.service');

class SearchController {
  /**
   * GET /api/v1/search
   * Query params:
   *  - q: search term (required, min 2 chars)
   *  - type: optional entity type filter (LOAD, LR, BILTY, TRIP, VEHICLE, DRIVER, CUSTOMER, LOCATION)
   */
  static async search(req, res, next) {
    try {
      const companyId = req.companyId || req.tenant?.companyId;
      const { q, type } = req.query;

      const result = await SearchService.search(companyId, q, type);

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Search completed successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SearchController;
