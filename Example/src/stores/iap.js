import {makeAutoObservable, configure} from "mobx"
import {Alert} from 'react-native';
import Iaphub from 'react-native-iaphub';
import pkg from '../../package.json';

configure({enforceActions: "never"});

class IAPStore {

	isInitialized = false;
	skuProcessing = null;
	productsForSale = null;
	activeProducts = null;
	billingStatus = null;

	constructor() {
    makeAutoObservable(this)
  }

	// Init IAPHUB
	async init() {
		// Init iaphub2
		await Iaphub.start({
			// The app id is available on the settings page of your app
			appId: "5e4890f6c61fc971cf46db4d",
			// The (client) api key is available on the settings page of your app
			apiKey: "SDp7aY220RtzZrsvRpp4BGFm6qZqNkNf",
			// Allow anonymous purchase
			allowAnonymousPurchase: true
		});
		// Add device params
		await Iaphub.setDeviceParams({appVersion: pkg.version});
		// Iaphub is now initialized and ready to use
		this.isInitialized = true;
		// Listen to user updates and refresh productsForSale/activeProducts
		Iaphub.addEventListener('onUserUpdate', async () => {
			console.log("-> Got user update");
			await this.refreshProducts();
		});
		Iaphub.addEventListener('onDeferredPurchase', async (transaction) => {
			console.log("-> Got deferred purchase: ", transaction);
		});
		Iaphub.addEventListener('onError', async (err) => {
			console.log("-> Got err: ", err);
		});
		Iaphub.addEventListener('onReceipt', async (receipt) => {
			//console.log("-> Got receipt: ", receipt);
		});
		Iaphub.addEventListener('onBuyRequest', async (opts) => {
			console.log("-> Got buy request: ", opts);
		});
	}

	// Login
	async login(userId) {
		await Iaphub.login(userId);
	}

	// Logout
	async logout() {
		await Iaphub.logout();
	}

	// Refresh products
	async refreshProducts() {
		try {
			// Refresh products
			var products = await Iaphub.getProducts();
			this.activeProducts = products.activeProducts;
			this.productsForSale = products.productsForSale;
			console.log('activeProducts: ', products.activeProducts);
			console.log('productsForSale: ', products.productsForSale);
			// Resfresh billing status
			this.billingStatus = await Iaphub.getBillingStatus();
		}
		catch (err) {
			console.error(err);
		}
	}

	// Call this method when an user click on one of your products
	async buy(productSku) {
		try {
			this.skuProcessing = productSku;
			var transaction = await Iaphub.buy(productSku);
			console.log('purchase: ', transaction);
			this.skuProcessing = null;
			// The webhook could not been sent to my server (Only needed if you're relying on webhooks)
			if (transaction.webhookStatus == "failed") {
				Alert.alert(
					"Purchase delayed",
					"Your purchase was successful but we need some more time to validate it, should arrive soon! Otherwise contact the support (support@myapp.com)"
				);
			}
			// Everything was successful! Yay!
			else {
				Alert.alert(
					"Purchase successful",
					"Your purchase has been processed successfully!"
				);
			}
		} catch (err) {
			// Stop loading
			this.skuProcessing = null;
			// Display error
			var errors = {
				// Couldn't buy product because it has been bought in the past but hasn't been consumed (restore needed)
				"product_already_owned": "Product already owned, please restore your purchases in order to fix that issue",
				// The payment has been deferred (its final status is pending external action such as 'Ask to Buy')
				"deferred_payment": "Purchase awaiting approval, your purchase has been processed but is awaiting approval",
				// The billing is unavailable (An iPhone can be restricted from accessing the Apple App Store)
				"billing_unavailable": "In-app purchase not allowed",
				// The remote server couldn't be reached properly
				"network_error": "Network error, please try to restore your purchases later (Button in the settings) or contact the support (support@myapp.com)",
				// The receipt has been processed on IAPHUB but something went wrong
				"receipt_failed": "We're having trouble validating your transaction, give us some time, we'll retry to validate your transaction ASAP",
				// The user has already an active subscription on a different platform (android or ios)
				"cross_platform_conflict": "It seems like you already have a subscription on a different platform, please use the same platform to change your subscription or wait for your current subscription to expire",
				// The transaction is successful but the product belongs to a different user
				"user_conflict": "Product owned by a different user, please use the account with which you originally bought the product or restore your purchases",
				// Unknown
				"unexpected": "We were not able to process your purchase, please try again later or contact the support (support@myapp.com)"
			};
			var errorsToIgnore = ["user_cancelled", "product_already_purchased"];
			var errorMessage = errors[err.code];

			if (!errorMessage && errorsToIgnore.indexOf(err.code) == -1) {
				errorMessage = errors["unexpected"];
			}
			if (errorMessage) {
				Alert.alert("Error", errorMessage);
			}
		}
	}

	// Call this method to restore the user purchases (you should have a button, it is usually displayed on the settings page)
	async restore() {
		var response = await Iaphub.restore();
		console.log("Response response: ", response);
		Alert.alert("Restore", "Purchases restored");
	}

	// Call this method to show the subscriptions page
	async showManageSubscriptions() {
		await Iaphub.showManageSubscriptions();
	}

	// Call this method to present the ios code redemption sheet
	async presentCodeRedemptionSheet() {
		await Iaphub.presentCodeRedemptionSheet();
	}

}

export default new IAPStore();