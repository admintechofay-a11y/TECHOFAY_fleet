/**
 * Global Search Service
 * Fast, debounced, tenant-scoped search across all core entities:
 * Loads, LRs, Bilties, Trips, Vehicles, Drivers, Customers, and Locations.
 */

const mongoose = require('mongoose');
const Load = require('../../loads/models/Load');
const LrNumber = require('../../lr/models/LrNumber');
const Bilty = require('../../bilties/models/Bilty');
const Trip = require('../../trips/models/Trip');
const Vehicle = require('../../vehicles/models/Vehicle');
const Driver = require('../../drivers/models/Driver');
const CustomerParty = require('../../customers/models/CustomerParty');
const Location = require('../../locations/models/Location');

class SearchService {
  /**
   * Performs debounced, sanitized search across core system entities
   * @param {string|ObjectId} companyId
   * @param {string} queryStr
   * @param {string} entityFilter - optional filter for specific entity type
   * @param {number} limitPerType
   */
  static async search(companyId, queryStr, entityFilter = null, limitPerType = 5) {
    const startTime = Date.now();
    const tenantObjectId = new mongoose.Types.ObjectId(companyId);

    const trimmed = (queryStr || '').trim();
    if (trimmed.length < 2) {
      return {
        query: trimmed,
        totalMatches: 0,
        executionTimeMs: 0,
        results: []
      };
    }

    // Escape special regex metacharacters to eliminate ReDoS vulnerabilities
    const escaped = trimmed.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const searchPromises = [];

    // 1. Loads Search
    if (!entityFilter || entityFilter === 'LOAD') {
      searchPromises.push(
        Load.find({
          companyId: tenantObjectId,
          $or: [{ loadNumber: regex }, { remarks: regex }]
        })
          .limit(limitPerType)
          .lean()
          .then((docs) =>
            docs.map((d) => ({
              id: d._id,
              type: 'LOAD',
              title: d.loadNumber,
              subtitle: `${d.originLocation || ''} → ${d.destinationLocation || ''} (₹${d.charges?.totalAmount || 0})`,
              status: d.status,
              url: '/app/loads'
            }))
          )
      );
    }

    // 2. LR Numbers Search
    if (!entityFilter || entityFilter === 'LR') {
      searchPromises.push(
        LrNumber.find({
          companyId: tenantObjectId,
          lrNumber: regex
        })
          .limit(limitPerType)
          .lean()
          .then((docs) =>
            docs.map((d) => ({
              id: d._id,
              type: 'LR',
              title: d.lrNumber,
              subtitle: `Associated Load LR • Status: ${d.status}`,
              status: d.status,
              url: '/app/lr'
            }))
          )
      );
    }

    // 3. Bilties Search
    if (!entityFilter || entityFilter === 'BILTY') {
      searchPromises.push(
        Bilty.find({
          companyId: tenantObjectId,
          biltyNumber: regex
        })
          .limit(limitPerType)
          .lean()
          .then((docs) =>
            docs.map((d) => ({
              id: d._id,
              type: 'BILTY',
              title: d.biltyNumber,
              subtitle: `Balance: ₹${d.balanceDue || 0} (${d.paymentTerms || 'Terms'})`,
              status: d.status,
              url: '/app/bilties'
            }))
          )
      );
    }

    // 4. Trips Search
    if (!entityFilter || entityFilter === 'TRIP') {
      searchPromises.push(
        Trip.find({
          companyId: tenantObjectId,
          tripNumber: regex
        })
          .limit(limitPerType)
          .lean()
          .then((docs) =>
            docs.map((d) => ({
              id: d._id,
              type: 'TRIP',
              title: d.tripNumber,
              subtitle: `Freight: ₹${d.freightAmount || 0} • Status: ${d.status}`,
              status: d.status,
              url: '/app/trips'
            }))
          )
      );
    }

    // 5. Vehicles Search
    if (!entityFilter || entityFilter === 'VEHICLE') {
      searchPromises.push(
        Vehicle.find({
          companyId: tenantObjectId,
          $or: [
            { plateNumber: regex },
            { registrationNumber: regex },
            { make: regex },
            { model: regex }
          ]
        })
          .limit(limitPerType)
          .lean()
          .then((docs) =>
            docs.map((d) => ({
              id: d._id,
              type: 'VEHICLE',
              title: d.plateNumber || d.registrationNumber,
              subtitle: `${d.make || ''} ${d.model || ''} (${d.category || d.vehicleType || 'Truck'}) • ${d.capacityTonnage || d.capacityMt || 0} MT`,
              status: d.status,
              url: '/app/vehicles'
            }))
          )
      );
    }

    // 6. Drivers Search
    if (!entityFilter || entityFilter === 'DRIVER') {
      searchPromises.push(
        Driver.find({
          companyId: tenantObjectId,
          $or: [
            { name: regex },
            { phone: regex },
            { licenseNumber: regex },
            { licenceNumber: regex }
          ]
        })
          .limit(limitPerType)
          .lean()
          .then((docs) =>
            docs.map((d) => ({
              id: d._id,
              type: 'DRIVER',
              title: d.name,
              subtitle: `DL: ${d.licenseNumber || d.licenceNumber || 'N/A'} • Phone: ${d.phone}`,
              status: d.status,
              url: '/app/drivers'
            }))
          )
      );
    }

    // 7. Customers Search
    if (!entityFilter || entityFilter === 'CUSTOMER') {
      searchPromises.push(
        CustomerParty.find({
          companyId: tenantObjectId,
          $or: [{ name: regex }, { gstin: regex }, { phone: regex }, { email: regex }]
        })
          .limit(limitPerType)
          .lean()
          .then((docs) =>
            docs.map((d) => ({
              id: d._id,
              type: 'CUSTOMER',
              title: d.name,
              subtitle: `GSTIN: ${d.gstin || 'Unregistered'} • ${d.city || ''}, ${d.state || ''}`,
              status: d.isActive ? 'ACTIVE' : 'INACTIVE',
              url: '/app/customers'
            }))
          )
      );
    }

    // 8. Locations Search
    if (!entityFilter || entityFilter === 'LOCATION') {
      searchPromises.push(
        Location.find({
          companyId: tenantObjectId,
          $or: [{ name: regex }, { city: regex }, { state: regex }]
        })
          .limit(limitPerType)
          .lean()
          .then((docs) =>
            docs.map((d) => ({
              id: d._id,
              type: 'LOCATION',
              title: d.name,
              subtitle: `${d.city || ''}, ${d.state || ''} (${d.type || 'Hub'})`,
              status: 'ACTIVE',
              url: '/app/locations'
            }))
          )
      );
    }

    const searchResultsArrays = await Promise.all(searchPromises);
    const flattened = searchResultsArrays.flat();

    const executionTimeMs = Date.now() - startTime;

    return {
      query: trimmed,
      totalMatches: flattened.length,
      executionTimeMs,
      results: flattened
    };
  }
}

module.exports = SearchService;
